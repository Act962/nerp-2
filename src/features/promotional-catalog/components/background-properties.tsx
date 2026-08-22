"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { constructUrl } from "@/hooks/use-construct-url";
import { uploadToR2 } from "@/lib/upload-to-r2";
import type { CatalogConfig } from "../types";

const PAGE_RATIO: Record<CatalogConfig["pageSize"], string> = {
  square: "1 / 1",
  story: "9 / 16",
  portrait: "3 / 4",
};

// Mede a imagem e devolve a proporção EXATA (largura/altura) + o preset de
// Tamanho de página mais próximo (para destacar o botão certo).
function measureImage(
  file: File,
): Promise<{ aspect: number; pageSize: CatalogConfig["pageSize"] } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const aspect = img.naturalWidth / img.naturalHeight;
      const opts: [CatalogConfig["pageSize"], number][] = [
        ["square", 1],
        ["portrait", 3 / 4],
        ["story", 9 / 16],
      ];
      let best = opts[0];
      let bestDiff = Number.POSITIVE_INFINITY;
      for (const o of opts) {
        const d = Math.abs(aspect - o[1]);
        if (d < bestDiff) {
          bestDiff = d;
          best = o;
        }
      }
      resolve({ aspect, pageSize: best[0] });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

interface BackgroundPropertiesProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}

// Propriedades do fundo (por página): miniatura na mesma proporção da página,
// trocar imagem, cor sólida ou degradê e transparência.
export function BackgroundProperties({
  config,
  onConfigChange,
}: BackgroundPropertiesProps) {
  const grad = config.backgroundGradient;
  const opacity = config.backgroundOpacity ?? 100;
  const imgUrl = config.backgroundImage
    ? constructUrl(config.backgroundImage)
    : null;

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const baseBg = grad
    ? `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`
    : config.backgroundColor;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const [key, measured] = await Promise.all([
        uploadToR2(file, true),
        measureImage(file),
      ]);
      onConfigChange({
        backgroundImage: key,
        // "Cobrir tudo" por padrão — mas a página assume a proporção EXATA da
        // imagem, então preenche sem cortar (fica no tamanho original).
        backgroundFit: "cover",
        ...(measured
          ? { pageAspect: measured.aspect, pageSize: measured.pageSize }
          : {}),
      });
    } catch {
      // silencioso — o usuário pode tentar de novo
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Propriedades do fundo
      </p>

      {/* Miniatura na proporção da página */}
      <div className="flex justify-center">
        <div
          className="w-28 overflow-hidden rounded-md border shadow-sm"
          style={{
            aspectRatio:
              config.pageAspect && config.pageAspect > 0
                ? String(config.pageAspect)
                : PAGE_RATIO[config.pageSize],
          }}
        >
          <div
            className="relative h-full w-full"
            style={{ background: baseBg, opacity: opacity / 100 }}
          >
            {imgUrl && (
              // biome-ignore lint/performance/noImgElement: prévia local do fundo
              <img
                src={imgUrl}
                alt=""
                className="absolute inset-0 h-full w-full"
                style={{
                  objectFit:
                    config.backgroundFit === "contain" ? "contain" : "cover",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Trocar imagem */}
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            Trocar imagem
          </Button>
          {config.backgroundImage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Remover imagem"
              onClick={() => onConfigChange({ backgroundImage: "" })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {config.backgroundImage && (
          <div className="flex gap-2">
            <Button
              variant={config.backgroundFit === "cover" ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onConfigChange({ backgroundFit: "cover" })}
            >
              Cobrir tudo
            </Button>
            <Button
              variant={
                config.backgroundFit === "contain" ? "default" : "outline"
              }
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onConfigChange({ backgroundFit: "contain" })}
            >
              Caber inteiro
            </Button>
          </div>
        )}
      </div>

      {/* Cor / Degradê */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={grad ? "outline" : "default"}
            className="text-xs"
            onClick={() => onConfigChange({ backgroundGradient: undefined })}
          >
            Cor sólida
          </Button>
          <Button
            type="button"
            size="sm"
            variant={grad ? "default" : "outline"}
            className="text-xs"
            onClick={() =>
              onConfigChange({
                backgroundGradient: grad ?? {
                  from: config.backgroundColor,
                  to: "#ffffff",
                  angle: 180,
                },
              })
            }
          >
            Degradê
          </Button>
        </div>

        {grad ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                De
                <input
                  type="color"
                  value={grad.from}
                  onChange={(e) =>
                    onConfigChange({
                      backgroundGradient: { ...grad, from: e.target.value },
                    })
                  }
                  className="h-7 w-9 cursor-pointer rounded border p-0"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Até
                <input
                  type="color"
                  value={grad.to}
                  onChange={(e) =>
                    onConfigChange({
                      backgroundGradient: { ...grad, to: e.target.value },
                    })
                  }
                  className="h-7 w-9 cursor-pointer rounded border p-0"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Ângulo</Label>
              <span className="text-xs text-muted-foreground">
                {grad.angle}°
              </span>
            </div>
            <Slider
              min={0}
              max={360}
              step={5}
              value={[grad.angle]}
              onValueChange={([v]) =>
                onConfigChange({ backgroundGradient: { ...grad, angle: v } })
              }
            />
          </div>
        ) : (
          <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            Cor de fundo
            <input
              type="color"
              value={config.backgroundColor}
              onChange={(e) =>
                onConfigChange({ backgroundColor: e.target.value })
              }
              className="h-7 w-9 cursor-pointer rounded border p-0"
            />
          </label>
        )}
      </div>

      {/* Transparência */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Transparência</Label>
          <span className="text-xs text-muted-foreground">{opacity}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[opacity]}
          onValueChange={([v]) => onConfigChange({ backgroundOpacity: v })}
        />
      </div>
    </div>
  );
}
