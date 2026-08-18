"use client";

import { ImagePlus, Loader2, PaintBucket, X } from "lucide-react";
import { useRef } from "react";
import { constructUrl } from "@/hooks/use-construct-url";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import type { CoverBackground } from "../../lib/cover-layout";
import { EDITOR_BUTTON_CLASS } from "./editor-controls";

interface CoverBackgroundPopoverProps {
  background: CoverBackground;
  onChange: (background: CoverBackground) => void;
  onUploadImage: (file: File) => Promise<string>;
  isUploadingImage: boolean;
}

const PRESET_COLORS = [
  "#ffffff",
  "#000000",
  "#c1121f",
  "#1a1a1a",
  "#f8fafc",
  "#0f172a",
];

export function CoverBackgroundPopover({
  background,
  onChange,
  onUploadImage,
  isUploadingImage,
}: CoverBackgroundPopoverProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const key = await onUploadImage(file);
    // Zera a opacidade da cor por cima pra imagem aparecer inteira assim que
    // sobe — o usuário liga o tint depois se quiser, ajustando o slider.
    onChange({ ...background, imageKey: key, opacity: 0 });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`gap-2 ${EDITOR_BUTTON_CLASS}`}
        >
          <span
            className="size-3.5 rounded-full border bg-cover bg-center"
            style={{
              backgroundColor: background.color,
              opacity: background.imageKey ? 1 : background.opacity,
              backgroundImage: background.imageKey
                ? `url(${constructUrl(background.imageKey)})`
                : undefined,
            }}
          />
          <PaintBucket className="size-4" /> Fundo
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Imagem de fundo</Label>
          {background.imageKey ? (
            <div className="relative overflow-hidden rounded-md border">
              {/* biome-ignore lint/performance/noImgElement: preview simples de key do R2, sem otimização do next/image */}
              <img
                src={constructUrl(background.imageKey)}
                alt=""
                className="h-24 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onChange({ ...background, imageKey: null })}
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                title="Remover imagem"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploadingImage ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Enviar imagem
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleUpload(file);
              event.target.value = "";
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Cor de fundo</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 rounded-md border"
              value={background.color}
              onChange={(event) =>
                onChange({ ...background, color: event.target.value })
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="size-6 rounded-full border"
                  style={{ backgroundColor: color }}
                  onClick={() => onChange({ ...background, color })}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            {background.imageKey
              ? `Tint sobre a imagem (${Math.round(background.opacity * 100)}%)`
              : `Transparência (${Math.round((1 - background.opacity) * 100)}%)`}
          </Label>
          <Slider
            value={[background.opacity * 100]}
            max={100}
            step={5}
            onValueChange={([value]) =>
              onChange({ ...background, opacity: value / 100 })
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
