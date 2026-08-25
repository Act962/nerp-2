"use client";

import { useMemo } from "react";
import { CatalogPreview } from "./catalog-preview";
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
  const visiblePages = pages
    .map((pg, i) => ({ pg, i }))
    .filter(({ pg }) => !isOfferExpired(pg.cfg));
  const allExpired = pages.length > 0 && visiblePages.length === 0;

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

        {visiblePages.map(({ pg, i }) => (
          <div
            key={srcPages[i]?.id ?? i}
            className="overflow-hidden rounded-lg shadow-lg"
          >
            <CatalogPreview
              config={pg.cfg}
              products={pg.products}
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
    </div>
  );
}
