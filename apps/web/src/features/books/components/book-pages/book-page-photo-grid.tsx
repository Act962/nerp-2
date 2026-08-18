"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { constructUrl } from "@/hooks/use-construct-url";
import { useIsMobile } from "@/hooks/use-mobile";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PHOTO_ADJUSTMENT,
  type PhotoAdjustment,
  type PhotoAdjustmentMap,
} from "../../lib/photo-adjustment";
import { AddPhotoButton } from "./add-photo-button";
import { PhotoAdjustDialog } from "./photo-adjust-dialog";

export const MAX_PHOTOS = 4;

export type PhotoLayoutPattern =
  | "PATTERN_1"
  | "PATTERN_2"
  | "PATTERN_3"
  | "PATTERN_4";

const PATTERNS: { value: PhotoLayoutPattern; label: string }[] = [
  {
    value: "PATTERN_1",
    label: "1 vertical à esquerda + 2 horizontais à direita",
  },
  {
    value: "PATTERN_2",
    label: "2 horizontais à esquerda + 1 vertical à direita",
  },
  { value: "PATTERN_3", label: "2 verticais lado a lado" },
  { value: "PATTERN_4", label: "2 horizontais empilhadas" },
];

// Posição explícita de cada foto (ou do tile "+") dentro da grade 2x2 para
// cada padrão nomeado. Padrões 1/2 têm 3 slots, 3/4 têm 2 slots.
const PATTERN_CELL_CLASSES: Record<PhotoLayoutPattern, string[]> = {
  PATTERN_1: [
    "col-start-1 row-start-1 row-span-2",
    "col-start-2 row-start-1",
    "col-start-2 row-start-2",
  ],
  PATTERN_2: [
    "col-start-1 row-start-1",
    "col-start-1 row-start-2",
    "col-start-2 row-start-1 row-span-2",
  ],
  PATTERN_3: [
    "col-start-1 row-start-1 row-span-2",
    "col-start-2 row-start-1 row-span-2",
  ],
  PATTERN_4: [
    "col-start-1 row-start-1 col-span-2",
    "col-start-1 row-start-2 col-span-2",
  ],
};

// Grade automática (sem padrão escolhido, ou quando a quantidade de fotos
// ultrapassa a capacidade do padrão escolhido): 1 foto = tela cheia, 2
// fotos = lado a lado, 3-4 fotos = grade 2x2. Sempre se reequilibra pra
// caber exatamente na página, sem crescer de altura.
function autoCellClassName(totalCells: number): string {
  if (totalCells === 1) return "col-span-2 row-span-2";
  if (totalCells === 2) return "col-span-1 row-span-2";
  return "col-span-1 row-span-1";
}

function cellClassName(
  pattern: PhotoLayoutPattern | null | undefined,
  index: number,
  totalCells: number,
): string {
  const patternClasses = pattern ? PATTERN_CELL_CLASSES[pattern] : null;
  // Usa o padrão nomeado enquanto ele cobrir fotos + tile "+" juntos — a
  // foto (ou o tile) ocupa o slot exato do modelo escolhido. Só cai no
  // automático se a quantidade ultrapassar a capacidade do padrão, senão
  // sobraria célula sem posição livre e o CSS Grid empurraria pra uma
  // linha invisível (some da tela).
  if (patternClasses && totalCells <= patternClasses.length) {
    return patternClasses[index] ?? autoCellClassName(totalCells);
  }
  return autoCellClassName(totalCells);
}

function PatternPreview({ pattern }: { pattern: PhotoLayoutPattern }) {
  const slots = PATTERN_CELL_CLASSES[pattern].length;
  return (
    <div className="grid h-5 w-6 grid-cols-2 grid-rows-2 gap-0.5">
      {Array.from({ length: slots }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, ordem nunca muda
          key={index}
          className={cn(
            "rounded-[1px] bg-current/70",
            PATTERN_CELL_CLASSES[pattern][index],
          )}
        />
      ))}
    </div>
  );
}

interface BookPagePhotoGridProps {
  photos: string[];
  layoutPattern?: PhotoLayoutPattern | null;
  photoAdjustments?: PhotoAdjustmentMap | null;
  onChange: (updater: (prev: string[]) => string[]) => void;
  onLayoutChange?: (pattern: PhotoLayoutPattern | null) => void;
  onAdjustmentChange?: (key: string, adjustment: PhotoAdjustment) => void;
  editable: boolean;
}

export function BookPagePhotoGrid({
  photos,
  layoutPattern,
  photoAdjustments,
  onChange,
  onLayoutChange,
  onAdjustmentChange,
  editable,
}: BookPagePhotoGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [isUploading, setIsUploading] = useState(false);
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null);
  const [adjustingAspectRatio, setAdjustingAspectRatio] = useState(1);

  const canAddMore = photos.length < MAX_PHOTOS;
  const showPatternAddTile = editable && canAddMore && !!layoutPattern;
  const showFloatingAddButton = editable && canAddMore && !layoutPattern;

  const cells: Array<{ type: "photo"; key: string } | { type: "add" }> = [
    ...photos.map((key) => ({ type: "photo" as const, key })),
    ...(showPatternAddTile ? [{ type: "add" as const }] : []),
  ];
  const totalCells = Math.max(cells.length, 1);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = Math.max(MAX_PHOTOS - photos.length, 0);
    if (remaining === 0) return;
    const toUpload = Array.from(files).slice(0, remaining);
    setIsUploading(true);
    try {
      const keys = await Promise.all(
        toUpload.map(async (file) =>
          uploadToR2(await compressImage(file), true),
        ),
      );
      // Updater funcional: se outro upload/remoção terminou primeiro
      // enquanto este ainda subia pro R2, aplica em cima do estado mais
      // recente em vez de sobrescrever com a foto antiga capturada no
      // início desta chamada — é isso que evitava fotos sumirem.
      onChange((prev) => [...prev, ...keys].slice(0, MAX_PHOTOS));
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (key: string) => {
    onChange((prev) => prev.filter((photo) => photo !== key));
  };

  // A ordem das fotos é a ordem dos espaços de foto do layout: a 1ª cai no
  // "Foto 1", a 2ª no "Foto 2", e assim por diante. Setas em vez de arrastar
  // porque o card inteiro já é arrastável pra reordenar páginas — no toque os
  // dois gestos se atropelariam.
  const movePhoto = (from: number, to: number) => {
    onChange((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-64 flex-col gap-2 md:min-h-0">
      {editable && onLayoutChange && (
        <div className="flex shrink-0 items-center gap-2 md:gap-1.5">
          <button
            type="button"
            title="Automático (sem padrão)"
            onClick={() => onLayoutChange(null)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md border transition-colors md:size-6",
              !layoutPattern
                ? "border-[#c1121f] bg-[#c1121f]"
                : "border-neutral-300 bg-neutral-200 hover:border-[#c1121f]",
            )}
          />
          {PATTERNS.map((pattern) => (
            <button
              key={pattern.value}
              type="button"
              title={pattern.label}
              onClick={() => onLayoutChange(pattern.value)}
              className={cn(
                "flex items-center justify-center rounded-md border p-2 text-neutral-400 transition-colors hover:border-[#c1121f] hover:text-[#c1121f] md:p-1",
                layoutPattern === pattern.value &&
                  "border-[#c1121f] bg-[#c1121f]/5 text-[#c1121f]",
              )}
            >
              <PatternPreview pattern={pattern.value} />
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2">
          {photos.length === 0 && !showPatternAddTile && (
            <div className="col-span-2 row-span-2 flex items-center justify-center rounded-lg border border-dashed text-sm text-neutral-500">
              Sem fotos
            </div>
          )}

          {cells.map((cell, index) => {
            if (cell.type === "photo") {
              const adjustment =
                photoAdjustments?.[cell.key] ?? DEFAULT_PHOTO_ADJUSTMENT;
              return (
                <div
                  key={cell.key}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border bg-neutral-100",
                    cellClassName(layoutPattern, index, totalCells),
                  )}
                >
                  {/* biome-ignore lint/performance/noImgElement: preview simples de key do R2, sem otimização do next/image */}
                  <img
                    src={constructUrl(cell.key)}
                    alt=""
                    // Sem lazy, abrir um book de 30 páginas dispara ~90
                    // downloads do R2 de uma vez — o navegador engasga antes
                    // de a primeira página ficar utilizável.
                    loading="lazy"
                    decoding="async"
                    onClick={(event) => {
                      if (!editable || !onAdjustmentChange) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setAdjustingAspectRatio(rect.width / rect.height);
                      setAdjustingKey(cell.key);
                    }}
                    className={cn(
                      "size-full object-cover",
                      editable && onAdjustmentChange && "cursor-pointer",
                    )}
                    style={{
                      objectPosition: `${adjustment.posX}% ${adjustment.posY}%`,
                      transform: `scale(${adjustment.zoom})`,
                    }}
                  />
                  {editable && (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1 py-0.5 text-white transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          movePhoto(index, index - 1);
                        }}
                        disabled={index === 0}
                        className="flex size-7 items-center justify-center rounded-full disabled:opacity-30 md:size-5"
                        title="Mover para antes"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span className="min-w-4 text-center text-[10px] font-semibold tabular-nums">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          movePhoto(index, index + 1);
                        }}
                        disabled={index === photos.length - 1}
                        className="flex size-7 items-center justify-center rounded-full disabled:opacity-30 md:size-5"
                        title="Mover para depois"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}
                  {editable && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removePhoto(cell.key);
                      }}
                      // Sem hover em toque: no mobile precisa ficar sempre
                      // visível, senão a foto não tem como ser removida.
                      className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-opacity md:size-6 md:opacity-0 md:group-hover:opacity-100"
                      title="Remover foto"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            }

            // Tile "+" do tamanho exato do slot vazio do padrão escolhido.
            return (
              <AddPhotoButton
                key="add-tile"
                isMobile={isMobile}
                isUploading={isUploading}
                onCamera={() => cameraInputRef.current?.click()}
                onGallery={() => fileInputRef.current?.click()}
                className={cn(
                  "flex items-center justify-center rounded-lg bg-neutral-300 transition-colors hover:bg-neutral-400",
                  cellClassName(layoutPattern, index, totalCells),
                )}
                iconWrapperClassName="flex size-11 items-center justify-center rounded-full bg-neutral-500/80 text-white"
              />
            );
          })}
        </div>

        {showFloatingAddButton && (
          <AddPhotoButton
            isMobile={isMobile}
            isUploading={isUploading}
            onCamera={() => cameraInputRef.current?.click()}
            onGallery={() => fileInputRef.current?.click()}
            className="absolute bottom-3 right-3 z-20 flex size-12 items-center justify-center rounded-full border-2 border-white bg-[#c1121f] text-white shadow-lg ring-2 ring-black/10 transition-colors hover:bg-[#a30f1a] md:size-10"
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {/* `capture` e `multiple` se excluem na prática (Chrome Android ignora
            o multiple), por isso o input de câmera é separado. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {adjustingKey && onAdjustmentChange && (
        <PhotoAdjustDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setAdjustingKey(null);
          }}
          photoUrl={constructUrl(adjustingKey)}
          aspectRatio={adjustingAspectRatio}
          initialAdjustment={photoAdjustments?.[adjustingKey]}
          onSave={(adjustment) => onAdjustmentChange(adjustingKey, adjustment)}
        />
      )}
    </div>
  );
}
