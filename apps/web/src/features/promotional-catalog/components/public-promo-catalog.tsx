"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogPreview, pageHeightOf } from "./catalog-preview";
import {
  type FindableProduct,
  PromoProductFinder,
} from "./promo-product-finder";
import { indexRowsForPages, pageNameIsGeneric } from "../lib/catalog-index";
import { distributePages, finalizeProducts } from "../lib/layout";
import type { CatalogConfig, CatalogProduct } from "../types";
import { ensurePages, isOfferExpired, virtualProductsFromList } from "../types";
import type { DynamicContext } from "../lib/resolve-entity";

interface PublicPromoCatalogProps {
  name: string;
  config: CatalogConfig;
  products: CatalogProduct[];
  // Entidades resolvidas por página (pageId → contexto) — páginas dinâmicas.
  dynamicEntities?: Record<string, DynamicContext>;
}

// Render PÚBLICO (read-only) do Catálogo Promocional — sem editor/painéis.
// Reusa `CatalogPreview` página a página, com a mesma distribuição do editor.
export function PublicPromoCatalog({
  name,
  config,
  products,
  dynamicEntities,
}: PublicPromoCatalogProps) {
  // Páginas na ORDEM (mesma do distributePages) — para casar o pageId com o
  // contexto dinâmico resolvido no servidor.
  const srcPages = ensurePages(config);
  const finalized = useMemo(
    () =>
      finalizeProducts(config, [
        ...products,
        ...virtualProductsFromList(config.list),
      ]),
    [config, products],
  );
  const pages = useMemo(
    () => distributePages(config, finalized),
    [config, finalized],
  );
  // Validade por página: cada página some do link quando o seu prazo vence.
  const visiblePages = useMemo(
    () =>
      pages
        .map((pg, i) => ({ pg, i }))
        .filter(({ pg }) => !isOfferExpired(pg.cfg)),
    [pages],
  );
  const allExpired = pages.length > 0 && visiblePages.length === 0;

  // Índice do buscador: produto → página em que ele aparece. A posição é a que
  // o LEITOR conta (página vencida não é renderizada e não entra na conta), por
  // isso o índice é o do array visível, não o da configuração.
  const findable = useMemo<FindableProduct[]>(() => {
    const seen = new Set<string>();
    const out: FindableProduct[] = [];
    visiblePages.forEach(({ pg, i }, j) => {
      const nome = srcPages[i]?.name?.trim();
      // Nome só entra quando diz algo — "Página 2" no rótulo de uma página que
      // é a 5ª visível seria pior que não ter nome nenhum. A regra do que é
      // genérico vem do índice, para os dois chamarem a página pelo mesmo nome.
      const pageLabel = pageNameIsGeneric(nome)
        ? `Página ${j + 1}`
        : `Página ${j + 1} · ${nome}`;
      for (const p of pg.products) {
        // O mesmo produto pode se repetir; a primeira aparição é a que resolve
        // "onde ele está".
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const promo = p.promotionalPrice;
        out.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          thumbnail: p.thumbnail,
          price: promo != null && promo > 0 ? promo : p.salePrice,
          pageIndex: j,
          pageLabel,
        });
      }
    });
    return out;
  }, [visiblePages, srcPages]);

  // Sumário calculado sobre as páginas VISÍVEIS, não sobre a config: página
  // vencida some daqui, e o leitor conta o que vê. É por isso que o número do
  // índice online pode diferir do PDF — lá o export leva todas as páginas.
  const indexRows = useMemo(
    () =>
      indexRowsForPages(
        visiblePages.map(({ i }) => srcPages[i]).filter((pg) => !!pg),
        visiblePages.map(({ pg }) => pg.products),
        pageHeightOf(config),
      ),
    [visiblePages, srcPages, config],
  );

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // "Ir ao topo" só depois de uma tela de rolagem: no começo ele não teria o
  // que fazer e só taparia a primeira página.
  const [mostrarTopo, setMostrarTopo] = useState(false);
  useEffect(() => {
    const aoRolar = () => setMostrarTopo(window.scrollY > window.innerHeight);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  const irParaPagina = (j: number) => {
    const alvo = pageRefs.current[j];
    if (!alvo) return;
    // Enquanto o diálogo fecha, o Radix segura o scroll do body e no fim
    // devolve a posição anterior — rolar uma vez só seria desfeito. Aqui a
    // rolagem é reemitida até o alvo encostar no topo, o que acontece assim que
    // a trava sai; para sozinha ao chegar e desiste em 1,5s.
    //
    // `setTimeout` e não `requestAnimationFrame`: em aba de segundo plano o rAF
    // não roda, e o link é feito para ser aberto de qualquer lugar. Pelo mesmo
    // motivo a rolagem é instantânea — animação suave também não avança com a
    // aba escondida.
    const limite = Date.now() + 1500;
    const passo = () => {
      const topo = alvo.getBoundingClientRect().top;
      if (Math.abs(topo) < 4) return;
      window.scrollTo({ top: topo + window.scrollY, behavior: "auto" });
      if (Date.now() < limite) setTimeout(passo, 32);
    };
    passo();
  };

  return (
    <div className="min-h-dvh bg-neutral-200 dark:bg-neutral-900">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-6 p-3 sm:p-6">
        <header className="text-center">
          <h1 className="text-lg font-semibold">{name}</h1>
          {allExpired && (
            <p className="mt-1 text-sm font-medium text-destructive">
              Oferta vencida
            </p>
          )}
        </header>

        {visiblePages.map(({ pg, i }, j) => (
          <div
            key={srcPages[i]?.id ?? i}
            ref={(el) => {
              pageRefs.current[j] = el;
            }}
            className="scroll-mt-3 overflow-hidden rounded-lg shadow-lg"
          >
            <CatalogPreview
              config={pg.cfg}
              products={pg.products}
              indexRows={indexRows[j]}
              onIndexNavigate={(n) => irParaPagina(n - 1)}
              allProducts={finalized}
              dynamicContext={
                srcPages[i] ? dynamicEntities?.[srcPages[i].id] : undefined
              }
            />
          </div>
        ))}

        <footer className="pb-6 text-center text-[11px] text-muted-foreground">
          Catálogo gerado no Órbita
        </footer>
      </div>

      {/* Empilha ACIMA do buscador, que ocupa o canto. Rolagem instantânea:
          num encarte de centenas de páginas o "suave" seria uma viagem — e em
          aba de segundo plano ele nem avança. */}
      {mostrarTopo && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="fixed right-4 bottom-24 z-40 size-14 rounded-full shadow-xl"
          aria-label="Ir ao topo"
          title="Ir ao topo"
          onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
        >
          <ArrowUp className="size-6" />
        </Button>
      )}

      <PromoProductFinder products={findable} onOpen={irParaPagina} />
    </div>
  );
}
