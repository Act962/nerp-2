"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { constructUrl } from "@/hooks/use-construct-url";
import type { Overlay } from "../types";

const CANVAS_W = 1080;
const DEFAULT_W = 260;

interface OverlayEditorProps {
  overlays: Overlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (overlays: Overlay[]) => void;
}

type Drag =
  | {
      mode: "move";
      id: string;
      sx: number;
      sy: number;
      ox: number;
      oy: number;
      scale: number;
    }
  | {
      mode: "resize";
      id: string;
      sx: number;
      ow: number;
      ar: number;
      scale: number;
    }
  | {
      mode: "rotate";
      id: string;
      cx: number;
      cy: number;
      start: number;
      orot: number;
    };

// Camada de edição das etiquetas — fica SOBRE o preview visível (fora do ref
// capturado), então as alças não entram na imagem exportada. Trabalha em px do
// canvas 1080×pageH e converte pela escala medida da própria camada.
export function OverlayEditor({
  overlays,
  selectedId,
  onSelect,
  onChange,
}: OverlayEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [layerW, setLayerW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setLayerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = layerW ? layerW / CANVAS_W : 0;
  const getScale = () => {
    const el = ref.current;
    return el ? el.getBoundingClientRect().width / CANVAS_W : 1;
  };

  const update = (id: string, patch: Partial<Overlay>) =>
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const remove = (id: string) => {
    onChange(overlays.filter((o) => o.id !== id));
    onSelect(null);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      update(d.id, {
        x: Math.round(d.ox + (e.clientX - d.sx) / d.scale),
        y: Math.round(d.oy + (e.clientY - d.sy) / d.scale),
      });
    } else if (d.mode === "resize") {
      const w = Math.max(24, Math.round(d.ow + (e.clientX - d.sx) / d.scale));
      update(d.id, { w, h: Math.round(w / d.ar) });
    } else if (d.mode === "rotate") {
      const angle =
        (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
      update(d.id, { rotation: Math.round(d.orot + (angle - d.start)) });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const beginDrag = (d: Drag) => {
    drag.current = d;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startMove = (e: React.PointerEvent, ov: Overlay) => {
    e.stopPropagation();
    onSelect(ov.id);
    beginDrag({
      mode: "move",
      id: ov.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: ov.x,
      oy: ov.y,
      scale: getScale(),
    });
  };

  const startResize = (e: React.PointerEvent, ov: Overlay) => {
    e.stopPropagation();
    onSelect(ov.id);
    beginDrag({
      mode: "resize",
      id: ov.id,
      sx: e.clientX,
      ow: ov.w,
      ar: ov.w / ov.h || 1,
      scale: getScale(),
    });
  };

  const startRotate = (e: React.PointerEvent, ov: Overlay) => {
    e.stopPropagation();
    onSelect(ov.id);
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = r.width / CANVAS_W;
    const cx = r.left + (ov.x + ov.w / 2) * s;
    const cy = r.top + (ov.y + ov.h / 2) * s;
    const start = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    beginDrag({ mode: "rotate", id: ov.id, cx, cy, start, orot: ov.rotation });
  };

  // Solta uma etiqueta arrastada da biblioteca — cria o overlay na posição.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const assetKey = e.dataTransfer.getData("text/plain");
    if (!assetKey) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = r.width / CANVAS_W;
    const cx = (e.clientX - r.left) / s;
    const cy = (e.clientY - r.top) / s;
    const img = new Image();
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight || 1;
      const w = DEFAULT_W;
      const h = Math.round(w / ar);
      const ov: Overlay = {
        id: crypto.randomUUID(),
        assetKey,
        x: Math.round(cx - w / 2),
        y: Math.round(cy - h / 2),
        w,
        h,
        rotation: 0,
      };
      onChange([...overlays, ov]);
      onSelect(ov.id);
    };
    img.src = constructUrl(assetKey);
  };

  const px = (v: number) => v * scale;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: camada de canvas (arrastar/soltar etiquetas)
    <div
      ref={ref}
      className="absolute inset-0"
      onPointerDown={() => onSelect(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {scale > 0 &&
        overlays.map((ov) => {
          const selected = ov.id === selectedId;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: alça de etiqueta arrastável no canvas
            <div
              key={ov.id}
              className={selected ? "absolute" : "absolute cursor-move"}
              style={{
                left: px(ov.x),
                top: px(ov.y),
                width: px(ov.w),
                height: px(ov.h),
                transform: ov.rotation
                  ? `rotate(${ov.rotation}deg)`
                  : undefined,
                outline: selected
                  ? "2px solid var(--color-primary, #2563eb)"
                  : undefined,
                cursor: "move",
              }}
              onPointerDown={(e) => startMove(e, ov)}
            >
              {selected && (
                <>
                  {/* Girar */}
                  <button
                    type="button"
                    className="absolute left-1/2 -top-7 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-foreground shadow"
                    title="Girar"
                    onPointerDown={(e) => startRotate(e, ov)}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  {/* Excluir */}
                  <button
                    type="button"
                    className="absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-destructive shadow"
                    title="Excluir etiqueta"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      remove(ov.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  {/* Redimensionar (canto inferior direito) */}
                  <button
                    type="button"
                    className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border-2 border-primary bg-background"
                    style={{ cursor: "nwse-resize" }}
                    title="Redimensionar"
                    onPointerDown={(e) => startResize(e, ov)}
                  />
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}
