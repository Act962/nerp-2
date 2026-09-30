"use client";

import type { EmblaOptionsType } from "embla-carousel";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Percent,
  SearchX,
} from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CatalogCategoryDisplay } from "@/generated/prisma/enums";
import { useQueryCatalogProducts } from "@/features/storefront/hooks/use-catalog-products";
import { useCatalogSettings } from "@/features/storefront/hooks/use-catalog-settings";
import {
  type CoresDoCartao,
  TEMA_PADRAO_CATALOGO,
  coresDoCartao,
  isHexValido,
  tintaSobre,
} from "@/features/storefront/lib/cores";
import { iconeDaCategoria } from "@/features/storefront/lib/icones-de-categoria";
import type { OfertaDaVitrine } from "@/features/storefront/server/ofertas";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { parseCurrencyInput } from "@/utils/currency-formatter";
import { FiltersCatalog } from "./filters";
import {
  type FormatoDoCartao,
  ProductCard,
  precoEmOferta,
} from "./product-card";

interface CatalogProps {
  subdomain: string;
}

type Categoria = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  icon: string | null;
};

/** Busca sem acento e sem caixa: "acucar" acha "Açúcar". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function Catalog({ subdomain }: CatalogProps) {
  const [categoriesSlugs, setCategoriesSlugs] = useQueryState("categories");
  const [busca, setBusca] = useQueryState("q");
  const [minValue] = useQueryState("min_value");
  const [maxValue] = useQueryState("max_value");

  const {
    data: catalogSettings,
    ofertas,
    isLoading,
  } = useCatalogSettings({ subdomain });

  const { data, isLoadingProducts } = useQueryCatalogProducts({
    subdomain,
    categories: categoriesSlugs?.trim().split(","),
    minValue: minValue ? parseCurrencyInput(minValue) : undefined,
    maxValue: maxValue ? parseCurrencyInput(maxValue) : undefined,
  });

  if (isLoading || isLoadingProducts) return <EsqueletoDaVitrine />;

  if (
    catalogSettings === undefined ||
    data === undefined ||
    catalogSettings.isActive === false
  ) {
    return notFound();
  }

  const tema = isHexValido(catalogSettings.theme)
    ? catalogSettings.theme
    : TEMA_PADRAO_CATALOGO;

  const coresDosCartoes = coresDoCartao(
    {
      fundo: catalogSettings.categoryCardColor,
      icone: catalogSettings.categoryIconColor,
      texto: catalogSettings.categoryTextColor,
    },
    tema,
  );

  const categorias = data.categories
    .filter((c) => !c.parentId && c.isActive && c.productCount > 0)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const nomeDaCategoria = new Map(data.categories.map((c) => [c.id, c.name]));

  const ativas = categoriesSlugs
    ? categoriesSlugs.split(",").map((s) => s.trim().toLowerCase())
    : [];
  const escolherCategoria = (slug: string | null) =>
    setCategoriesSlugs(
      slug && !ativas.includes(slug.toLowerCase()) ? slug : null,
    );

  const termo = normalizar(busca?.trim() ?? "");
  const produtos = termo
    ? data.products.filter((p) => normalizar(p.name).includes(termo))
    : data.products;
  const emOferta = data.products.filter((p) =>
    precoEmOferta(p.salePrice, p.promotionalPrice),
  );
  const filtrando = ativas.length > 0 || termo.length > 0;

  const cartao = (
    produto: (typeof produtos)[number],
    className?: string,
    formato?: FormatoDoCartao,
  ) => (
    <ProductCard
      key={produto.id}
      className={className}
      formato={formato}
      id={produto.id}
      name={produto.name}
      slug={produto.slug}
      thumbnail={produto.thumbnail}
      salePrice={produto.salePrice}
      promotionalPrice={produto.promotionalPrice}
      categoria={
        produto.categoryId ? nomeDaCategoria.get(produto.categoryId) : undefined
      }
      subdomain={subdomain}
      isDisponile={produto.productIsDisponile}
      allowsOrders={catalogSettings.allowOrders}
      mostrarPreco={catalogSettings.showPrices}
      tema={tema}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-5 sm:py-7">
      <Destaque
        banners={catalogSettings.bannerImages ?? []}
        ofertas={ofertas}
        tema={tema}
      />

      {categorias.length > 0 && (
        <section id="categorias" className="scroll-mt-40 flex flex-col gap-4">
          <CabecalhoDaSecao titulo="Navegue por categoria">
            {ativas.length > 0 && (
              <button
                type="button"
                onClick={() => escolherCategoria(null)}
                className="text-muted-foreground text-sm hover:text-foreground"
              >
                Ver todas
              </button>
            )}
          </CabecalhoDaSecao>
          <ul
            className={cn(
              "grid grid-cols-[repeat(var(--colunas-celular),minmax(0,1fr))] gap-3 sm:gap-4",
              categorias.length <= MAX_CATEGORIAS_NA_LINHA
                ? "sm:grid-cols-[repeat(var(--colunas),minmax(0,1fr))]"
                : "sm:flex sm:overflow-x-auto sm:pb-2",
            )}
            style={
              {
                "--colunas": categorias.length,
                "--colunas-celular": colunasNoCelular(categorias.length),
              } as React.CSSProperties
            }
          >
            {categorias.map((categoria) => (
              <li
                key={categoria.id}
                className={cn(
                  categorias.length > MAX_CATEGORIAS_NA_LINHA &&
                    "sm:w-32 sm:shrink-0",
                )}
              >
                <CartaoDaCategoria
                  categoria={categoria}
                  modo={catalogSettings.categoryDisplay}
                  tema={tema}
                  cores={coresDosCartoes}
                  ativa={ativas.includes(categoria.slug.toLowerCase())}
                  onClick={() => {
                    escolherCategoria(categoria.slug);
                    document
                      .getElementById("produtos")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sem preço não existe oferta: a faixa sai junto com os valores. */}
      {!filtrando && catalogSettings.showPrices && emOferta.length > 0 && (
        <section className="flex flex-col gap-4">
          <CabecalhoDaSecao titulo="Em oferta">
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-xs"
              style={{ backgroundColor: tema, color: tintaSobre(tema) }}
            >
              <Percent className="size-3" />
              {emOferta.length}
            </span>
          </CabecalhoDaSecao>
          <Ofertas
            quantidade={emOferta.length}
            cartoes={(formato, className) =>
              emOferta.map((produto) => cartao(produto, className, formato))
            }
          />
        </section>
      )}

      <section id="produtos" className="scroll-mt-40 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <h2 className="shrink-0 font-bold text-xl sm:text-2xl">
            {termo ? `Resultados para "${busca}"` : "Produtos"}
          </h2>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <AbaDaCategoria
              ativa={ativas.length === 0}
              tema={tema}
              onClick={() => escolherCategoria(null)}
            >
              Todos
            </AbaDaCategoria>
            {categorias.map((categoria) => (
              <AbaDaCategoria
                key={categoria.id}
                ativa={ativas.includes(categoria.slug.toLowerCase())}
                tema={tema}
                onClick={() => escolherCategoria(categoria.slug)}
              >
                {categoria.name}
              </AbaDaCategoria>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              {produtos.length} produto(s)
            </span>
            <FiltersCatalog categories={data.categories} />
          </div>
        </div>

        {produtos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center text-card-foreground">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="font-medium">Nenhum produto encontrado</p>
            {filtrando && (
              <button
                type="button"
                className="text-sm underline"
                onClick={() => {
                  setBusca(null);
                  setCategoriesSlugs(null);
                }}
              >
                Limpar busca e filtros
              </button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {produtos.map((produto) => (
              <li key={produto.id} className="flex">
                {cartao(produto, "w-full")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CabecalhoDaSecao({
  titulo,
  children,
}: {
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-bold text-xl sm:text-2xl">{titulo}</h2>
      {children}
    </div>
  );
}

function AbaDaCategoria({
  ativa,
  tema,
  onClick,
  children,
}: {
  ativa: boolean;
  tema: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 border-b-2 px-3 py-1.5 text-sm transition-colors",
        ativa
          ? "font-semibold"
          : "border-transparent opacity-70 hover:opacity-100",
      )}
      style={ativa ? { borderColor: tema } : undefined}
    >
      {children}
    </button>
  );
}

function CartaoDaCategoria({
  categoria,
  modo,
  tema,
  cores,
  ativa,
  onClick,
}: {
  categoria: Categoria;
  modo: CatalogCategoryDisplay;
  tema: string;
  cores: CoresDoCartao;
  ativa: boolean;
  onClick: () => void;
}) {
  const urlDaImagem = useConstructUrl(categoria.image ?? "");
  const Icone = iconeDaCategoria(categoria.icon);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2.5 rounded-xl border border-black/5 p-3 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        modo === "TEXT" ? "min-h-16" : "min-h-28 sm:min-h-32",
      )}
      style={{
        backgroundColor: cores.fundo,
        color: cores.texto,
        ...(ativa && { borderColor: tema, boxShadow: `0 0 0 1px ${tema}` }),
      }}
    >
      {modo === "ICON" && (
        <Icone
          className="size-9"
          strokeWidth={1.5}
          style={{ color: cores.icone }}
        />
      )}
      {modo === "IMAGE" && (
        <span className="relative flex size-14 items-center justify-center overflow-hidden rounded-full bg-black/5 sm:size-16">
          {categoria.image ? (
            <Image
              src={urlDaImagem}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <Icone
              className="size-7"
              strokeWidth={1.5}
              style={{ color: cores.icone }}
            />
          )}
        </span>
      )}
      <span
        className={cn(
          "line-clamp-2 text-xs leading-tight sm:text-sm",
          modo === "TEXT" && "font-semibold",
        )}
      >
        {categoria.name}
      </span>
    </button>
  );
}

/** Até quantas categorias dividem a linha; acima disso, a fila rola. */
const MAX_CATEGORIAS_NA_LINHA = 8;

/**
 * Colunas no celular: a que deixa menos buraco na última linha. Com 4, duas
 * linhas de 2 ficam melhor que 3 + 1; com 5, 3 + 2 vence 2 + 2 + 1.
 */
function colunasNoCelular(quantidade: number): number {
  if (quantidade <= 3) return Math.max(quantidade, 1);
  const buraco = (colunas: number) =>
    (colunas - (quantidade % colunas)) % colunas;
  return buraco(2) < buraco(3) ? 2 : 3;
}

/**
 * As ofertas se arrumam pela quantidade, para nunca sobrar tela vazia:
 * uma vira destaque de largura inteira, duas dividem a linha deitadas, três
 * ou quatro dividem a linha em pé, e daí para cima vira fila com setas.
 */
function Ofertas({
  quantidade,
  cartoes,
}: {
  quantidade: number;
  cartoes: (formato: FormatoDoCartao, className: string) => React.ReactNode;
}) {
  if (quantidade === 1) return <>{cartoes("destaque", "w-full")}</>;

  if (quantidade === 2) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {cartoes("horizontal", "w-full")}
      </div>
    );
  }

  if (quantidade <= 4) {
    return (
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(var(--colunas),minmax(0,1fr))] sm:gap-4"
        style={{ "--colunas": quantidade } as React.CSSProperties}
      >
        {cartoes("grade", "w-full")}
      </div>
    );
  }

  return (
    <FaixaRolavel>
      {cartoes("grade", "w-40 shrink-0 snap-start sm:w-48")}
    </FaixaRolavel>
  );
}

/**
 * Uma fila horizontal com setas no desktop; no celular, só o dedo. Cada seta
 * só aparece quando há para onde ir — seta que não leva a nada é ruído.
 */
function FaixaRolavel({ children }: { children: React.ReactNode }) {
  const faixa = useRef<HTMLDivElement>(null);
  const [limites, setLimites] = useState({ voltar: false, avancar: false });

  useEffect(() => {
    const elemento = faixa.current;
    if (!elemento) return;
    const medir = () =>
      setLimites({
        voltar: elemento.scrollLeft > 4,
        avancar:
          elemento.scrollLeft + elemento.clientWidth < elemento.scrollWidth - 4,
      });
    medir();
    elemento.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => {
      elemento.removeEventListener("scroll", medir);
      observador.disconnect();
    };
  }, []);

  const rolar = (sentido: 1 | -1) =>
    faixa.current?.scrollBy({
      left: sentido * faixa.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <div className="relative">
      <div
        ref={faixa}
        className="flex snap-x gap-3 overflow-x-auto pb-2 sm:gap-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {children}
      </div>
      {limites.voltar && (
        <SetaDaFaixa lado="esquerda" onClick={() => rolar(-1)} />
      )}
      {limites.avancar && (
        <SetaDaFaixa lado="direita" onClick={() => rolar(1)} />
      )}
    </div>
  );
}

function SetaDaFaixa({
  lado,
  onClick,
}: {
  lado: "esquerda" | "direita";
  onClick: () => void;
}) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "esquerda" ? "Anteriores" : "Próximos"}
      className={cn(
        "-translate-y-1/2 absolute top-1/2 hidden size-9 items-center justify-center rounded-full border border-black/5 bg-white text-neutral-900 shadow-md hover:bg-neutral-100 sm:flex",
        lado === "esquerda" ? "-left-4" : "-right-4",
      )}
    >
      <Icone className="size-4" />
    </button>
  );
}

/**
 * O topo da vitrine: carrossel com os banners e, ao lado, o cartão das
 * ofertas. Sem ofertas o carrossel ocupa a largura toda; sem banner, o cartão
 * de ofertas sobra sozinho — e sem nenhum dos dois o topo simplesmente some.
 */
function Destaque({
  banners,
  ofertas,
  tema,
}: {
  banners: string[];
  ofertas: OfertaDaVitrine[];
  tema: string;
}) {
  const opcoes: EmblaOptionsType = { loop: true };
  const [emblaRef, emblaApi] = useEmblaCarousel(opcoes, [
    Autoplay({ playOnInit: true, delay: 5000 }),
  ]);

  if (banners.length === 0 && ofertas.length === 0) return null;

  return (
    <section
      className={cn(
        "grid gap-4",
        banners.length > 0 && ofertas.length > 0 && "lg:grid-cols-3",
      )}
    >
      {banners.length > 0 && (
        <div className="relative lg:col-span-2">
          <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
            <div className="flex">
              {banners.map((banner, indice) => (
                <BannerDoCarrossel
                  key={banner}
                  chave={banner}
                  indice={indice}
                />
              ))}
            </div>
          </div>
          {banners.length > 1 && (
            <div className="absolute right-3 bottom-3 flex gap-1.5">
              <button
                type="button"
                aria-label="Banner anterior"
                onClick={() => emblaApi?.scrollPrev()}
                className="flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Próximo banner"
                onClick={() => emblaApi?.scrollNext()}
                className="flex size-8 items-center justify-center rounded-full shadow"
                style={{ backgroundColor: tema, color: tintaSobre(tema) }}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {ofertas.length > 0 && (
        <div
          className="flex min-h-44 flex-col justify-between gap-4 rounded-2xl p-6 sm:p-8"
          style={{ backgroundColor: tema, color: tintaSobre(tema) }}
        >
          <div className="flex flex-col gap-2">
            <Percent className="size-8 opacity-80" />
            <p className="font-bold text-2xl leading-tight sm:text-3xl">
              Confira nossas ofertas
            </p>
            <p className="text-sm opacity-85">
              {ofertas.length === 1
                ? ofertas[0].nome
                : `${ofertas.length} catálogos com preços especiais`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ofertas.map((oferta) => (
              <a
                key={oferta.shareToken}
                href={`/promocao/${oferta.shareToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 font-semibold text-neutral-900 text-sm shadow-sm transition-transform hover:scale-[1.02]"
              >
                {ofertas.length === 1 ? "Ver ofertas" : oferta.nome}
                <ExternalLink className="size-3.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BannerDoCarrossel({
  chave,
  indice,
}: {
  chave: string;
  indice: number;
}) {
  const url = useConstructUrl(chave);
  return (
    <div className="relative aspect-[16/7] min-w-0 shrink-0 grow-0 basis-full sm:aspect-[16/6]">
      <Image
        src={url}
        alt={`Destaque ${indice + 1}`}
        fill
        priority={indice === 0}
        sizes="(max-width: 1024px) 100vw, 760px"
        className="object-cover"
      />
    </div>
  );
}

function EsqueletoDaVitrine() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-5 sm:py-7">
      <Skeleton className="aspect-[16/7] w-full rounded-2xl bg-accent-foreground/10 sm:aspect-[16/5]" />
      <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-4">
        {Array.from({ length: 6 }).map((_, indice) => (
          <Skeleton
            key={indice}
            className="h-28 rounded-xl bg-accent-foreground/10 sm:w-32 sm:shrink-0"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, indice) => (
          <Skeleton
            key={indice}
            className="aspect-[3/4] rounded-xl bg-accent-foreground/10"
          />
        ))}
      </div>
    </div>
  );
}
