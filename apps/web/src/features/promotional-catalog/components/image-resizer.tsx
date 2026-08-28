"use client";

import { useRef, useState } from "react";
import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_IMAGE_ADJUSTMENT, type ImageAdjustment } from "../types";
import { imageStyleFromAdjust } from "./cards/image-style";

// Redimensionador de imagem PADRÃO DO SISTEMA: enquadramento (Caber/Cobrir),
// zoom (nós de canto + botões) e posição (X/Y). Opera sobre um `ImageAdjustment`.
// Usado no "Editar produto" e na etiqueta dinâmica (overlay com imagem).
type BoxRect = { x: number; y: number; w: number; h: number };

// Nós de redimensionar o BOX (largura/altura independentes). Cantos mudam as
// duas dimensões; meios de borda mudam só uma. Ancorado no lado oposto.
const BOX_HANDLES: {
  key: string;
  cls: string;
  axes: string; // combinação de l/r/t/b
  cursor: string;
}[] = [
  { key: "tl", cls: "left-1.5 top-1.5", axes: "lt", cursor: "nwse-resize" },
  {
    key: "tc",
    cls: "left-1/2 top-1.5 -translate-x-1/2",
    axes: "t",
    cursor: "ns-resize",
  },
  { key: "tr", cls: "right-1.5 top-1.5", axes: "rt", cursor: "nesw-resize" },
  {
    key: "ml",
    cls: "left-1.5 top-1/2 -translate-y-1/2",
    axes: "l",
    cursor: "ew-resize",
  },
  {
    key: "mr",
    cls: "right-1.5 top-1/2 -translate-y-1/2",
    axes: "r",
    cursor: "ew-resize",
  },
  { key: "bl", cls: "left-1.5 bottom-1.5", axes: "lb", cursor: "nesw-resize" },
  {
    key: "bc",
    cls: "left-1/2 bottom-1.5 -translate-x-1/2",
    axes: "b",
    cursor: "ns-resize",
  },
  { key: "br", cls: "right-1.5 bottom-1.5", axes: "rb", cursor: "nwse-resize" },
];

const MIN_BOX = 20; // px mínimos no canvas

export function ImageResizer({
  src,
  adjust,
  onChange,
  onReset,
  emptyLabel = "Sem foto",
  baseline = DEFAULT_IMAGE_ADJUSTMENT,
  box,
  onBoxChange,
}: {
  src: string;
  adjust: ImageAdjustment | undefined;
  onChange: (patch: Partial<ImageAdjustment>) => void;
  onReset?: () => void;
  emptyLabel?: string;
  // Ajuste "neutro" (sem edição). Produto = Cobrir (default); etiqueta = Caber.
  baseline?: ImageAdjustment;
  // Box da etiqueta (px no canvas). Quando presente, mostra os nós de
  // redimensionar largura/altura (independentes) e o preview reflete a proporção.
  box?: BoxRect;
  onBoxChange?: (box: BoxRect) => void;
}) {
  const adj = adjust ?? baseline;
  const [showPos, setShowPos] = useState(false);

  const isAdjusted =
    adj.scale !== baseline.scale ||
    adj.posX !== baseline.posX ||
    adj.posY !== baseline.posY ||
    adj.fit !== baseline.fit ||
    // Sem isto uma foto SÓ girada não conta como ajustada, e o "Restaurar"
    // não aparece para desfazer o giro.
    (adj.rotation ?? 0) !== (baseline.rotation ?? 0);

  const hasBox = !!box && !!onBoxChange;

  // Nó de zoom (canto) — fallback quando NÃO há box (ex.: foto de produto).
  const scaleDrag = useRef<{ sy: number; base: number } | null>(null);
  const onScalePointerMove = (e: PointerEvent) => {
    const d = scaleDrag.current;
    if (!d) return;
    const delta = (d.sy - e.clientY) / 120;
    onChange({
      scale: Math.min(3, Math.max(0.5, Math.round((d.base + delta) * 10) / 10)),
    });
  };
  const onScalePointerUp = () => {
    scaleDrag.current = null;
    window.removeEventListener("pointermove", onScalePointerMove);
    window.removeEventListener("pointerup", onScalePointerUp);
  };
  const startScaleDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    scaleDrag.current = { sy: e.clientY, base: adj.scale };
    window.addEventListener("pointermove", onScalePointerMove);
    window.addEventListener("pointerup", onScalePointerUp);
  };

  // Redimensionar o BOX (largura/altura). Mapeia o arraste em px de tela → px de
  // canvas pela escala do preview (medida no início do arraste).
  const previewRef = useRef<HTMLDivElement>(null);
  const boxDrag = useRef<{
    axes: string;
    sx: number;
    sy: number;
    base: BoxRect;
    scale: number;
  } | null>(null);
  const onBoxPointerMove = (e: PointerEvent) => {
    const d = boxDrag.current;
    if (!d || !onBoxChange) return;
    const dx = (e.clientX - d.sx) / d.scale;
    const dy = (e.clientY - d.sy) / d.scale;
    let { x, y, w, h } = d.base;
    if (d.axes.includes("r")) w = Math.max(MIN_BOX, d.base.w + dx);
    if (d.axes.includes("l")) {
      w = Math.max(MIN_BOX, d.base.w - dx);
      x = d.base.x + (d.base.w - w);
    }
    if (d.axes.includes("b")) h = Math.max(MIN_BOX, d.base.h + dy);
    if (d.axes.includes("t")) {
      h = Math.max(MIN_BOX, d.base.h - dy);
      y = d.base.y + (d.base.h - h);
    }
    onBoxChange({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
    });
  };
  const onBoxPointerUp = () => {
    boxDrag.current = null;
    window.removeEventListener("pointermove", onBoxPointerMove);
    window.removeEventListener("pointerup", onBoxPointerUp);
  };
  const startBoxResize = (e: React.PointerEvent, axes: string) => {
    if (!box || !previewRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = previewRef.current.getBoundingClientRect();
    // px de tela por px de canvas (o preview mostra o box inteiro).
    const scale = box.w > 0 ? rect.width / box.w : 1;
    boxDrag.current = { axes, sx: e.clientX, sy: e.clientY, base: box, scale };
    window.addEventListener("pointermove", onBoxPointerMove);
    window.addEventListener("pointerup", onBoxPointerUp);
  };

  return (
    <div className="flex flex-col gap-3">
      {onReset && isAdjusted && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1 text-xs"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar
        </Button>
      )}

      <div
        ref={previewRef}
        className={cn(
          "group relative mx-auto w-full max-w-[240px] overflow-hidden rounded-lg border bg-muted",
          !hasBox && "aspect-square",
        )}
        style={
          hasBox && box
            ? { aspectRatio: `${box.w} / ${box.h}`, maxHeight: 300 }
            : undefined
        }
      >
        {src ? (
          // biome-ignore lint/performance/noImgElement: preview local do ajuste
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={imageStyleFromAdjust(adj)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}
        <div className="pointer-events-none absolute inset-3 rounded-sm border border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.04)]" />
        {hasBox
          ? BOX_HANDLES.map((hd) => (
              <button
                key={hd.key}
                type="button"
                title="Arraste para redimensionar (largura/altura)"
                onPointerDown={(e) => startBoxResize(e, hd.axes)}
                className={cn(
                  "absolute h-3.5 w-3.5 rounded-sm border-2 border-primary bg-background shadow",
                  hd.cls,
                )}
                style={{ cursor: hd.cursor, touchAction: "none" }}
              />
            ))
          : [
              "left-2 top-2",
              "right-2 top-2",
              "left-2 bottom-2",
              "right-2 bottom-2",
            ].map((pos) => (
              <button
                key={pos}
                type="button"
                title="Arraste para redimensionar (zoom)"
                onPointerDown={startScaleDrag}
                className={cn(
                  "absolute h-3.5 w-3.5 rounded-sm border-2 border-primary bg-background shadow",
                  pos,
                )}
                style={{ cursor: "nwse-resize" }}
              />
            ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1 rounded-md border p-1.5">
        <Button
          type="button"
          size="sm"
          variant={adj.fit === "contain" ? "default" : "outline"}
          className="h-7 px-2 text-[11px]"
          onClick={() => onChange({ fit: "contain" })}
        >
          Caber
        </Button>
        <Button
          type="button"
          size="sm"
          variant={adj.fit === "cover" ? "default" : "outline"}
          className="h-7 px-2 text-[11px]"
          onClick={() => onChange({ fit: "cover" })}
        >
          Cobrir
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          title="Diminuir zoom"
          onClick={() =>
            onChange({
              scale: Math.max(0.5, Math.round((adj.scale - 0.1) * 10) / 10),
            })
          }
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-9 text-center text-[11px] tabular-nums">
          {Math.round(adj.scale * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          title="Aumentar zoom"
          onClick={() =>
            onChange({
              scale: Math.min(3, Math.round((adj.scale + 0.1) * 10) / 10),
            })
          }
        >
          <Plus className="h-3 w-3" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        {/* Giro em passos de 90°: foto deitada é o caso real, e ângulo livre
            num botão só levaria a produto torto sem querer. O ângulo fino fica
            em "Posições", junto dos outros ajustes finos. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          title="Girar 90°"
          onClick={() =>
            onChange({ rotation: (((adj.rotation ?? 0) + 90) % 360) as number })
          }
        >
          <RotateCw className="h-3 w-3" />
        </Button>
        {!!adj.rotation && (
          <span className="w-9 text-center text-[11px] tabular-nums">
            {adj.rotation}°
          </span>
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          size="sm"
          variant={showPos ? "default" : "outline"}
          className="h-7 px-2 text-[11px]"
          onClick={() => setShowPos((s) => !s)}
        >
          Posições
        </Button>
      </div>

      {showPos && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">
              Posição horizontal
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={adj.posX}
              onChange={(e) => onChange({ posX: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">
              Posição vertical
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={adj.posY}
              onChange={(e) => onChange({ posY: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
