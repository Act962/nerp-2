"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { LayoutGrid, List, Presentation, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

export type BookView = "list" | "grid" | "slides";

// Limites do zoom (%) — como no Canva, dá pra afastar bastante e aproximar um
// pouco além de 100%.
export const BOOK_ZOOM_MIN = 20;
export const BOOK_ZOOM_MAX = 150;

interface BookBottomBarProps {
  view: BookView;
  onViewChange: (view: BookView) => void;
  totalPages: number;
  onGoToPage: (pageNumber: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

// Barra inferior suspensa (estilo Canva) do editor do book: alterna entre
// visualizar em lista e em grade, e pula direto para uma página pelo número.
export function BookBottomBar({
  view,
  onViewChange,
  totalPages,
  onGoToPage,
  zoom,
  onZoomChange,
}: BookBottomBarProps) {
  const [pageInput, setPageInput] = useState("");

  const go = () => {
    const n = Number(pageInput);
    if (!Number.isFinite(n) || n < 1) return;
    onGoToPage(Math.min(Math.max(1, Math.round(n)), totalPages));
    setPageInput("");
  };

  const clampZoom = (z: number) =>
    Math.min(BOOK_ZOOM_MAX, Math.max(BOOK_ZOOM_MIN, z));

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full items-center gap-2 rounded-xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={view === "list" ? "secondary" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={() => onViewChange("list")}
          title="Visualizar em lista"
        >
          <List className="size-4" />
          Lista
        </Button>
        <Button
          type="button"
          variant={view === "grid" ? "secondary" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={() => onViewChange("grid")}
          title="Visualizar em grade (miniaturas)"
        >
          <LayoutGrid className="size-4" />
          Grade
        </Button>
        <Button
          type="button"
          variant={view === "slides" ? "secondary" : "ghost"}
          size="sm"
          className="gap-1"
          onClick={() => onViewChange("slides")}
          title="Editar em slides: miniaturas à esquerda, página editável à direita"
        >
          <Presentation className="size-4" />
          Slides
        </Button>
      </div>

      <div className="ml-1 flex items-center gap-1.5 border-l pl-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onZoomChange(clampZoom(zoom - 10))}
          disabled={zoom <= BOOK_ZOOM_MIN}
          title="Diminuir zoom"
        >
          <ZoomOut className="size-4" />
        </Button>
        <Slider
          min={BOOK_ZOOM_MIN}
          max={BOOK_ZOOM_MAX}
          step={5}
          value={[zoom]}
          onValueChange={([next]) => onZoomChange(clampZoom(next))}
          className="w-28"
          aria-label="Zoom"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onZoomChange(clampZoom(zoom + 10))}
          disabled={zoom >= BOOK_ZOOM_MAX}
          title="Aumentar zoom"
        >
          <ZoomIn className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => onZoomChange(100)}
          className="w-11 text-right text-sm tabular-nums text-muted-foreground hover:text-foreground"
          title="Restaurar zoom (100%)"
        >
          {Math.round(zoom)}%
        </button>
      </div>

      <div className="ml-1 flex items-center gap-1.5 border-l pl-2 text-sm">
        <span className="hidden text-muted-foreground sm:inline">
          Ir para página
        </span>
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              go();
              e.currentTarget.blur();
            }
          }}
          placeholder="nº"
          className="h-8 w-16 text-center"
          aria-label="Ir para página"
        />
        <span className="whitespace-nowrap text-muted-foreground">
          / {totalPages}
        </span>
        <Button type="button" size="sm" onClick={go} disabled={!pageInput}>
          Ir
        </Button>
      </div>
    </div>
  );
}
