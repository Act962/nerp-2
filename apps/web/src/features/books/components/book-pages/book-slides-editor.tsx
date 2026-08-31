"use client";

import { cn } from "@/lib/utils";
import { constructUrl } from "@/hooks/use-construct-url";
import { useEffect, useState } from "react";
import type { BookVariableValues } from "../../lib/book-variables";
import {
  isBackground,
  isElementArray,
  LayoutPreview,
  type LayoutLogos,
} from "../templates/layout-preview";
import type { BookPageV2 } from "./book-page-card-v2";
import { SlideCanvas } from "./slide-canvas";

interface BookSlidesEditorProps {
  pages: BookPageV2[];
  /** Layout/fundo do book, herdados por páginas sem layout próprio. */
  pageLayout: unknown;
  pageBackground: unknown;
  logos: LayoutLogos;
  variableValues: BookVariableValues;
  /** Número global da 1ª página desta lista (a capa é a 1). */
  pageNumberStart: number;
}

/** Fotos da página indexadas por slot (buracos viram string vazia). */
function slotPhotoUrls(page: BookPageV2): string[] {
  const maxSlot = page.items.reduce(
    (max, it) => Math.max(max, it.slotIndex),
    -1,
  );
  const urls: string[] = [];
  for (let i = 0; i <= maxSlot; i++) {
    const item = page.items.find((it) => it.slotIndex === i);
    urls[i] = item?.photoKey ? constructUrl(item.photoKey) : "";
  }
  return urls;
}

function pageTitle(page: BookPageV2): string {
  if (page.isExtra) return "Página extra";
  return page.storeName ?? "Página";
}

/**
 * Edição em slides: miniaturas à esquerda, a página selecionada editável à
 * direita.
 *
 * A diferença para as vistas Lista/Grade não é visual — é que aqui o canvas
 * está SEMPRE aberto. Antes, mexer em texto, imagem ou fundo exigia abrir o
 * diálogo "Editar layout", fechá-lo e reabrir na próxima página; quem nunca
 * usou a ferramenta não achava a edição.
 */
export function BookSlidesEditor({
  pages,
  pageLayout,
  pageBackground,
  logos,
  variableValues,
  pageNumberStart,
}: BookSlidesEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    pages[0]?.id ?? null,
  );

  // A página selecionada pode sumir (exclusão, resync): cai na primeira.
  useEffect(() => {
    if (selectedId && pages.some((page) => page.id === selectedId)) return;
    setSelectedId(pages[0]?.id ?? null);
  }, [pages, selectedId]);

  const selected = pages.find((page) => page.id === selectedId) ?? null;

  if (pages.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Este book ainda não tem páginas. Adicione uma na vista em Lista.
      </p>
    );
  }

  return (
    <div className="flex gap-4">
      <nav
        aria-label="Páginas do book"
        className="flex max-h-[75vh] w-40 shrink-0 flex-col gap-2 overflow-y-auto pr-1"
      >
        {pages.map((page, index) => {
          const isSelected = page.id === selectedId;
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => setSelectedId(page.id)}
              aria-current={isSelected}
              className={cn(
                "flex shrink-0 flex-col gap-1 rounded-md border p-1 text-left transition-colors",
                isSelected
                  ? "border-primary ring-2 ring-primary/30"
                  : "hover:border-muted-foreground/40",
              )}
            >
              <LayoutPreview
                layout={
                  isElementArray(page.pageLayout) ? page.pageLayout : pageLayout
                }
                background={
                  isBackground(page.pageBackground)
                    ? page.pageBackground
                    : pageBackground
                }
                photoUrls={slotPhotoUrls(page)}
                variableValues={{
                  ...variableValues,
                  loja: page.storeName ?? "",
                }}
                logos={logos}
              />
              <span className="truncate px-1 pb-0.5 text-xs text-muted-foreground">
                {pageNumberStart + index}. {pageTitle(page)}
              </span>
            </button>
          );
        })}
      </nav>

      {selected && (
        // `key` força a remontagem ao trocar de página — é o desmonte que faz
        // o SlideCanvas gravar o que ainda estava no debounce.
        <SlideCanvas
          key={selected.id}
          bookPageId={selected.id}
          title={`${pageNumberStart + pages.indexOf(selected)}. ${pageTitle(selected)}`}
          layout={
            isElementArray(selected.pageLayout)
              ? selected.pageLayout
              : pageLayout
          }
          background={
            isBackground(selected.pageBackground)
              ? selected.pageBackground
              : pageBackground
          }
          variableValues={{
            ...variableValues,
            loja: selected.storeName ?? "",
          }}
          photoPreviewUrls={slotPhotoUrls(selected)}
          logos={logos}
        />
      )}
    </div>
  );
}
