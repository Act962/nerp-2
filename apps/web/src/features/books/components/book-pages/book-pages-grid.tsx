"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { useTemplateForBook } from "../../hooks/use-books";
import type { BookVariableValues } from "../../lib/book-variables";
import {
  buildDefaultClosingLayout,
  buildDefaultCoverLayout,
  type CoverBackground,
  type CoverElement,
  DEFAULT_COVER_BACKGROUND,
} from "../../lib/cover-layout";
import {
  isBackground,
  isElementArray,
  LayoutPreview,
  type LayoutLogos,
} from "../templates/layout-preview";
import type { BookPageItem } from "./book-page-card";
import type { BookPageV2 } from "./book-page-card-v2";

interface GridTile {
  number: number;
  label: string;
  layout: CoverElement[] | null;
  background: CoverBackground | null;
  photoUrls: string[];
  variables: BookVariableValues;
}

interface BookPagesGridProps {
  supplierId: string | null;
  coverLayout: unknown;
  closingLayout: unknown;
  coverBackground: unknown;
  closingBackground: unknown;
  pageLayout: unknown;
  pageBackground: unknown;
  pages: BookPageV2[];
  items: BookPageItem[];
  logos: LayoutLogos;
  variableValues: BookVariableValues;
  onGoToPage: (pageNumber: number) => void;
}

function firstArrayLayout(...candidates: unknown[]): CoverElement[] | null {
  for (const c of candidates) if (isElementArray(c)) return c;
  return null;
}

function firstBackground(...candidates: unknown[]): CoverBackground | null {
  for (const c of candidates) if (isBackground(c)) return c;
  return null;
}

// Fotos de uma página V2 indexadas por slot (buracos viram string vazia).
function v2PhotoUrls(page: BookPageV2): string[] {
  const maxSlot = page.items.reduce((m, it) => Math.max(m, it.slotIndex), -1);
  const urls: string[] = [];
  for (let i = 0; i <= maxSlot; i++) {
    const it = page.items.find((x) => x.slotIndex === i);
    urls[i] = it?.photoKey ? constructUrl(it.photoKey) : "";
  }
  return urls;
}

// Visualização em grade: miniaturas de TODAS as páginas (capa → conteúdo →
// final) no mesmo aspecto da página, clicáveis para pular direto pra ela.
export function BookPagesGrid({
  supplierId,
  coverLayout,
  closingLayout,
  coverBackground,
  closingBackground,
  pageLayout,
  pageBackground,
  pages,
  items,
  logos,
  variableValues,
  onGoToPage,
}: BookPagesGridProps) {
  const { template } = useTemplateForBook(supplierId);

  const tiles: GridTile[] = [];
  let number = 1;

  // Capa (mesma cascata do BookCoverCard: book → template → built-in).
  tiles.push({
    number: number++,
    label: "Capa",
    layout:
      firstArrayLayout(coverLayout, template?.coverLayout) ??
      buildDefaultCoverLayout(),
    background:
      firstBackground(coverBackground, template?.coverBackground) ??
      DEFAULT_COVER_BACKGROUND,
    photoUrls: [],
    variables: variableValues,
  });

  // Páginas de conteúdo (modelo novo).
  for (const page of pages) {
    tiles.push({
      number: number++,
      label: page.isExtra ? "Página extra" : (page.storeName ?? "Loja"),
      layout: firstArrayLayout(page.pageLayout, pageLayout),
      background: firstBackground(page.pageBackground, pageBackground),
      photoUrls: v2PhotoUrls(page),
      variables: {
        ...variableValues,
        loja: page.storeName,
        cidade: page.storeCity ?? null,
        uf: page.storeState ?? null,
      },
    });
  }

  // Itens legados (books antigos).
  for (const item of items) {
    tiles.push({
      number: number++,
      label: item.storeName,
      layout: firstArrayLayout(item.pageLayout, pageLayout),
      background: firstBackground(item.pageBackground, pageBackground),
      photoUrls: item.photos.map((key) => constructUrl(key)),
      variables: { ...variableValues, loja: item.storeName },
    });
  }

  // Página final.
  tiles.push({
    number: number++,
    label: "Página final",
    layout:
      firstArrayLayout(closingLayout, template?.closingLayout) ??
      buildDefaultClosingLayout(),
    background:
      firstBackground(closingBackground, template?.closingBackground) ??
      DEFAULT_COVER_BACKGROUND,
    photoUrls: [],
    variables: variableValues,
  });

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tiles.map((tile) => (
        <button
          key={tile.number}
          type="button"
          onClick={() => onGoToPage(tile.number)}
          className="group text-left"
          title={`Ir para a página ${tile.number} — ${tile.label}`}
        >
          <div className="overflow-hidden rounded-md border bg-muted transition group-hover:ring-2 group-hover:ring-primary">
            {tile.layout ? (
              <LayoutPreview
                layout={tile.layout}
                background={tile.background}
                photoUrls={tile.photoUrls}
                variableValues={tile.variables}
                logos={logos}
              />
            ) : (
              <div className="flex aspect-[960/540] items-center justify-center overflow-hidden">
                {tile.photoUrls[0] ? (
                  // biome-ignore lint/performance/noImgElement: miniatura simples de key do R2
                  <img
                    src={tile.photoUrls[0]}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sem layout
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground group-hover:text-foreground">
            <span className="font-semibold text-foreground">
              {tile.number}.
            </span>{" "}
            {tile.label}
          </p>
        </button>
      ))}
    </div>
  );
}
