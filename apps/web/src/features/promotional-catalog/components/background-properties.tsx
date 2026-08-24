"use client";

import { useRef, useState } from "react";
import { ImageIcon, ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { constructUrl } from "@/hooks/use-construct-url";
import { uploadToR2 } from "@/lib/upload-to-r2";
import type { CatalogConfig } from "../types";
import {
  ColorSwatch,
  FieldRow,
  SectionCard,
  Segmented,
  SliderRow,
} from "./panel-ui";

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
    <SectionCard>
      {/* Miniatura na proporção da página */}
      <div className="flex justify-center">
        <div
          className="w-32 overflow-hidden rounded-xl border shadow-sm"
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

      {/* Cor sólida / Degradê */}
      <Segmented
        value={grad ? "grad" : "solid"}
        onChange={(v) =>
          onConfigChange({
            backgroundGradient:
              v === "solid"
                ? undefined
                : (grad ?? {
                    from: config.backgroundColor,
                    to: "#ffffff",
                    angle: 180,
                  }),
          })
        }
        options={[
          { value: "solid", label: "Cor sólida" },
          { value: "grad", label: "Degradê" },
        ]}
      />

      {grad ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-6">
            <FieldRow label="De" className="flex-1">
              <ColorSwatch
                value={grad.from}
                onChange={(v) =>
                  onConfigChange({ backgroundGradient: { ...grad, from: v } })
                }
              />
            </FieldRow>
            <FieldRow label="Até" className="flex-1">
              <ColorSwatch
                value={grad.to}
                onChange={(v) =>
                  onConfigChange({ backgroundGradient: { ...grad, to: v } })
                }
              />
            </FieldRow>
          </div>
          <SliderRow
            label="Ângulo"
            value={grad.angle}
            min={0}
            max={360}
            step={5}
            onChange={(v) =>
              onConfigChange({ backgroundGradient: { ...grad, angle: v } })
            }
            format={(v) => `${v}°`}
          />
        </div>
      ) : (
        <FieldRow label="Cor de fundo">
          <ColorSwatch
            value={config.backgroundColor}
            onChange={(v) => onConfigChange({ backgroundColor: v })}
          />
        </FieldRow>
      )}

      {/* Transparência */}
      <SliderRow
        label="Transparência"
        value={opacity}
        min={0}
        max={100}
        onChange={(v) => onConfigChange({ backgroundOpacity: v })}
        format={(v) => `${v}%`}
      />

      {/* Imagem de fundo */}
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
          className="h-10 flex-1 gap-2 rounded-xl text-[14px] lg:h-9 lg:text-[13px]"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : config.backgroundImage ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <ImageUp className="h-4 w-4" />
          )}
          {config.backgroundImage ? "Trocar imagem" : "Imagem de fundo"}
        </Button>
        {config.backgroundImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-destructive lg:h-9 lg:w-9"
            title="Remover imagem"
            onClick={() => onConfigChange({ backgroundImage: "" })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {config.backgroundImage && (
        <Segmented
          value={config.backgroundFit === "contain" ? "contain" : "cover"}
          onChange={(v) => onConfigChange({ backgroundFit: v })}
          options={[
            { value: "cover", label: "Cobrir tudo" },
            { value: "contain", label: "Caber inteiro" },
          ]}
        />
      )}
    </SectionCard>
  );
}
