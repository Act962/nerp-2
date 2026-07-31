"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { bakePhoto } from "../lib/bake-photo";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Largura do código como fração da foto. Teto em 50%: acima disso ele começa
 * a cobrir a própria ação fotografada. */
const MIN_SCALE = 0.1;
const MAX_SCALE = 0.5;

// Espelha o `drawSeal` do bake-photo.ts, para a prévia mostrar o selo no mesmo
// lugar e tamanho em que ele será gravado.
const SEAL_WIDTH_RATIO = 0.24;
const SEAL_PAD_RATIO = 0.02;

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
  const [sealLoaded, setSealLoaded] = useState(false);
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
      const { blob, codigoFaltando } = await bakePhoto({
        file,
        textLines,
        // Chave, não URL: o carimbo é lido pelo proxy de mesma origem.
        codigo: codigoKey
          ? { key: codigoKey, x: pos.x, y: pos.y, scale: pos.scale }
          : null,
      });
      if (codigoFaltando) {
        toast.warning("A foto foi salva SEM a imagem do código", {
          description:
            "Não foi possível carregar o código desta indústria. Avise a coordenação.",
          duration: 10000,
        });
      }
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

      {/* `w-fit` para a caixa acompanhar EXATAMENTE a foto renderizada. Antes
        ela ocupava a largura toda e, em foto retrato (o normal no celular), a
        imagem ficava centralizada com barras nas laterais — o selo e as
        coordenadas do arraste eram medidos contra a caixa, não contra a foto,
        então saíam deslocados do que o `bakePhoto` grava. */}
      <div
        ref={containerRef}
        className="relative mx-auto w-fit touch-none overflow-hidden rounded-lg border bg-neutral-900"
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
            className="block max-h-[60vh] w-auto max-w-full"
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
              // Acima do texto e do selo, igual ao `bakePhoto`, que desenha o
              // código por último. Sem isto a prévia mostraria o código
              // coberto pelas tarjas e o arquivo salvo mostraria o contrário.
              zIndex: 10,
            }}
          />
        )}

        {/* Selo Órbita: só prévia. Quem grava de fato é o `drawSeal` do
          bake-photo. Mostrar aqui evita o promotor posicionar o código
          justamente em cima dele e só descobrir depois de salvar. */}
        <div
          className="pointer-events-none absolute bg-black/55"
          style={{
            right: `${SEAL_PAD_RATIO * 100}%`,
            bottom: `${SEAL_PAD_RATIO * 100}%`,
            width: `${(SEAL_WIDTH_RATIO + SEAL_PAD_RATIO * 2) * 100}%`,
            padding: `${SEAL_PAD_RATIO * 100}%`,
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: selo estático em public/ */}
          <img
            src="/orbita-hub.svg"
            alt=""
            onLoad={() => setSealLoaded(true)}
            className={`w-full ${sealLoaded ? "" : "opacity-0"}`}
          />
        </div>

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
        // Slider no lugar dos botões +/-: com o dedo, arrastar até o tamanho
        // certo é mais rápido que tocar N vezes de 5% em 5%.
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Tamanho do código
            </span>
            <span className="text-xs font-medium tabular-nums">
              {Math.round(pos.scale * 100)}%
            </span>
          </div>
          <Slider
            value={[pos.scale]}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            onValueChange={([value]) =>
              setPos((prev) => ({
                ...prev,
                scale: clamp(value, MIN_SCALE, MAX_SCALE),
                // Reposiciona se o novo tamanho jogaria o código para fora
                // pela direita.
                x: clamp(prev.x, 0, 1 - value),
              }))
            }
            aria-label="Tamanho do código"
          />
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
