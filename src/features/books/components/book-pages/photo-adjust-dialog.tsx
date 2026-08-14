"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BACKDROP_COLOR,
  DEFAULT_PHOTO_ADJUSTMENT,
  focusPolygonCss,
  type PhotoAdjustment,
  type PhotoBackdrop,
} from "../../lib/photo-adjustment";
import { FocusPolygonOverlay } from "./focus-region-overlay";

const MAX_ZOOM = 3;

const BACKDROP_OPTIONS: { value: PhotoBackdrop; label: string }[] = [
  { value: "none", label: "Sem fundo" },
  { value: "blur", label: "Desfocado" },
  { value: "color", label: "Cor" },
];

interface PhotoAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string;
  aspectRatio: number;
  initialAdjustment: PhotoAdjustment | undefined;
  onSave: (adjustment: PhotoAdjustment) => void;
  objectFit?: "cover" | "contain";
  // Só os espaços de foto do layout personalizado renderizam fundo/foco; nas
  // páginas de padrão fixo esses controles não teriam efeito, então ficam ocultos.
  allowBackdrop?: boolean;
  // Mostra o toggle "Preencher / Caber inteira" — o fit passa a ser controlado
  // pelo próprio ajuste (adjustment.objectFit), não pela prop objectFit.
  allowFit?: boolean;
  // Troca do arquivo da foto direto do diálogo, sem fechar.
  onReplacePhoto?: (file: File) => void;
}

export function PhotoAdjustDialog({
  open,
  onOpenChange,
  photoUrl,
  aspectRatio,
  initialAdjustment,
  onSave,
  objectFit = "cover",
  allowBackdrop = false,
  allowFit = false,
  onReplacePhoto,
}: PhotoAdjustDialogProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [adjustment, setAdjustment] = useState<PhotoAdjustment>(
    initialAdjustment ?? DEFAULT_PHOTO_ADJUSTMENT,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setAdjustment(initialAdjustment ?? DEFAULT_PHOTO_ADJUSTMENT);
    }
  }, [open, initialAdjustment]);

  const backdrop: PhotoBackdrop = allowBackdrop
    ? (adjustment.backdrop ?? "none")
    : "none";
  const focusPolygon = adjustment.focusPolygon ?? [];
  const focusClip = focusPolygonCss(focusPolygon);
  // Fit efetivo: com allowFit quem manda é o próprio ajuste; senão a prop.
  const effectiveFit: "cover" | "contain" = allowFit
    ? (adjustment.objectFit ?? "cover")
    : objectFit;

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosX: adjustment.posX,
      startPosY: adjustment.posY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const dragState = dragStateRef.current;
    const container = containerRef.current;
    const image = imageRef.current;
    if (!dragState || !container || !image?.naturalWidth) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const scale = Math.max(
      containerWidth / image.naturalWidth,
      containerHeight / image.naturalHeight,
    );
    const excessX = image.naturalWidth * scale - containerWidth;
    const excessY = image.naturalHeight * scale - containerHeight;

    const dxPx = event.clientX - dragState.startClientX;
    const dyPx = event.clientY - dragState.startClientY;

    const deltaPosX =
      excessX > 0 ? (-100 * (dxPx / adjustment.zoom)) / excessX : 0;
    const deltaPosY =
      excessY > 0 ? (-100 * (dyPx / adjustment.zoom)) / excessY : 0;

    setAdjustment((prev) => ({
      ...prev,
      posX: clamp(dragState.startPosX + deltaPosX, 0, 100),
      posY: clamp(dragState.startPosY + deltaPosY, 0, 100),
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    dragStateRef.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar enquadramento</DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-lg border bg-neutral-100"
          style={{ aspectRatio }}
        >
          {backdrop === "color" && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor:
                  adjustment.backdropColor ?? DEFAULT_BACKDROP_COLOR,
              }}
            />
          )}

          {backdrop === "blur" ? (
            // Foco seletivo: a foto inteira sai desfocada e, por cima, a mesma
            // foto nítida recortada no polígono que o usuário desenha nó a nó.
            <>
              {/* biome-ignore lint/performance/noImgElement: preview de ajuste, sem otimização do next/image */}
              <img
                src={photoUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full select-none object-cover"
                style={{
                  objectPosition: `${adjustment.posX}% ${adjustment.posY}%`,
                  transform: `scale(${adjustment.zoom})`,
                  filter: "blur(6px)",
                }}
              />
              {focusClip && (
                // biome-ignore lint/performance/noImgElement: preview de ajuste, sem otimização do next/image
                <img
                  src={photoUrl}
                  alt=""
                  className="absolute inset-0 size-full select-none object-cover"
                  style={{
                    objectPosition: `${adjustment.posX}% ${adjustment.posY}%`,
                    transform: `scale(${adjustment.zoom})`,
                    clipPath: focusClip,
                  }}
                />
              )}
              <FocusPolygonOverlay
                points={focusPolygon}
                onChange={(next) =>
                  setAdjustment((prev) => ({ ...prev, focusPolygon: next }))
                }
              />
            </>
          ) : (
            <>
              {effectiveFit === "contain" && (
                // Fundo desfocado da própria foto, igual ao que o PDF compõe.
                // biome-ignore lint/performance/noImgElement: preview de ajuste, sem otimização do next/image
                <img
                  src={photoUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 size-full select-none object-cover"
                  style={{ filter: "blur(12px)", transform: "scale(1.1)" }}
                />
              )}
              {/* biome-ignore lint/performance/noImgElement: preview de ajuste, sem otimização do next/image */}
              <img
                ref={imageRef}
                src={photoUrl}
                alt=""
                draggable={false}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={cn(
                  "relative size-full cursor-grab touch-none select-none active:cursor-grabbing",
                  effectiveFit === "contain"
                    ? "object-contain"
                    : "object-cover",
                )}
                style={{
                  objectPosition: `${adjustment.posX}% ${adjustment.posY}%`,
                  transform: `scale(${adjustment.zoom})`,
                }}
              />
            </>
          )}
        </div>
        {backdrop === "blur" && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">
              Clique para criar cada nó, arraste para mover, duplo-clique para
              remover. O interior fica nítido; o resto, desfocado.
            </p>
            {focusPolygon.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-xs"
                onClick={() =>
                  setAdjustment((prev) => ({ ...prev, focusPolygon: [] }))
                }
              >
                Limpar nós
              </Button>
            )}
          </div>
        )}

        {onReplacePhoto && (
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => replaceInputRef.current?.click()}
            >
              <ImageUp className="size-4" /> Trocar foto
            </Button>
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onReplacePhoto(file);
                event.target.value = "";
              }}
            />
          </>
        )}

        {allowFit && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-neutral-500">
              Como a foto ocupa o espaço
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={effectiveFit === "cover" ? "default" : "outline"}
                className="h-9"
                onClick={() =>
                  setAdjustment((prev) => ({ ...prev, objectFit: "cover" }))
                }
              >
                Preencher
              </Button>
              <Button
                type="button"
                size="sm"
                variant={effectiveFit === "contain" ? "default" : "outline"}
                className="h-9"
                onClick={() =>
                  setAdjustment((prev) => ({ ...prev, objectFit: "contain" }))
                }
              >
                Caber inteira
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-neutral-500">Zoom</p>
          <Slider
            value={[adjustment.zoom]}
            min={1}
            max={MAX_ZOOM}
            step={0.05}
            onValueChange={([zoom]) =>
              setAdjustment((prev) => ({ ...prev, zoom }))
            }
          />
        </div>

        <div className="space-y-2" hidden={!allowBackdrop}>
          <p className="text-xs font-medium text-neutral-500">
            Fundo / foco da foto
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {BACKDROP_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={backdrop === option.value ? "default" : "outline"}
                className="h-9"
                onClick={() =>
                  setAdjustment((prev) => ({ ...prev, backdrop: option.value }))
                }
              >
                {option.label}
              </Button>
            ))}
            {backdrop === "color" && (
              <input
                type="color"
                aria-label="Cor do fundo"
                value={adjustment.backdropColor ?? DEFAULT_BACKDROP_COLOR}
                onChange={(event) =>
                  setAdjustment((prev) => ({
                    ...prev,
                    backdropColor: event.target.value,
                  }))
                }
                className="size-9 cursor-pointer rounded-md border"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(adjustment);
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
