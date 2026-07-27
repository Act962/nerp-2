"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { Check, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { bakePhoto } from "../lib/bake-photo";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Editor do carimbo: mostra a foto, deixa arrastar a imagem do código de ação e
// exibe as linhas de texto que serão gravadas. Ao confirmar, compõe + sobe pro
// R2 e devolve a chave.
export function StampEditor({
  file,
  codigoKey,
  textLines,
  onCancel,
  onBaked,
}: {
  file: File;
  codigoKey: string | null;
  textLines: string[];
  onCancel: () => void;
  onBaked: (photoKey: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0.62, y: 0.06, scale: 0.3 });
  const [saving, setSaving] = useState(false);
  const dragging = useRef(false);

  // Object URL criado dentro do efeito (uma por `file`): assim o double-invoke
  // do StrictMode em dev revoga só a URL descartada, nunca a que está em uso.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const codigoUrl = codigoKey ? constructUrl(codigoKey) : null;

  const moveTo = (clientX: number, clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setPos((prev) => ({
      ...prev,
      x: clamp(
        (clientX - box.left) / box.width - prev.scale / 2,
        0,
        1 - prev.scale,
      ),
      y: clamp((clientY - box.top) / box.height, 0, 1),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const blob = await bakePhoto({
        file,
        textLines,
        codigo: codigoUrl
          ? { url: codigoUrl, x: pos.x, y: pos.y, scale: pos.scale }
          : null,
      });
      const baked = new File([blob], `promotor-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      const key = await uploadToR2(await compressImage(baked), true);
      onBaked(key);
    } catch (error) {
      toast.error(
        error instanceof Error && /suport|bitmap|imagem/i.test(error.message)
          ? "Formato de imagem não suportado, tente outra foto"
          : "Não foi possível salvar a foto",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Arraste o código para o local da foto onde ele deve ficar. Nome, data e
        localização são carimbados no rodapé.
      </p>

      <div
        ref={containerRef}
        className="relative w-full touch-none overflow-hidden rounded-lg border bg-neutral-900"
        onPointerMove={(event) => {
          if (dragging.current) moveTo(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {previewUrl && (
          // biome-ignore lint/performance/noImgElement: preview local (objectURL), sem otimização do next/image
          <img
            src={previewUrl}
            alt=""
            className="max-h-[60vh] w-full object-contain"
          />
        )}

        {codigoUrl && (
          // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
          <img
            src={codigoUrl}
            alt="Código da ação"
            draggable={false}
            onPointerDown={(event) => {
              event.preventDefault();
              dragging.current = true;
            }}
            style={{
              position: "absolute",
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: `${pos.scale * 100}%`,
              cursor: "grab",
              touchAction: "none",
            }}
          />
        )}

        {/* Prévia das linhas de texto (canto inferior esquerdo). */}
        <div className="pointer-events-none absolute bottom-2 left-2 space-y-1">
          {textLines.filter(Boolean).map((line) => (
            <span
              key={line}
              className="inline-block rounded bg-black/55 px-2 py-0.5 text-xs font-semibold text-white"
            >
              {line}
            </span>
          ))}
        </div>
      </div>

      {codigoUrl ? (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">
            Tamanho do código
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() =>
              setPos((prev) => ({
                ...prev,
                scale: clamp(prev.scale - 0.05, 0.1, 0.6),
              }))
            }
          >
            <Minus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() =>
              setPos((prev) => ({
                ...prev,
                scale: clamp(prev.scale + 0.05, 0.1, 0.6),
              }))
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-amber-600">
          Esta indústria não tem imagem de código de ação cadastrada — a foto
          será salva só com o texto.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 gap-2"
          disabled={saving}
          onClick={onCancel}
        >
          <RotateCcw className="size-4" /> Refazer
        </Button>
        <Button
          type="button"
          className="h-12 flex-[2] gap-2"
          disabled={saving}
          onClick={save}
        >
          {saving ? <Spinner /> : <Check className="size-4" />}
          Salvar foto
        </Button>
      </div>
    </div>
  );
}
