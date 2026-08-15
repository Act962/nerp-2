"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BRAND_ASPECT,
  BRAND_PAD_RATIO,
  BRAND_WIDTH_RATIO,
  SEAL_BOX_ALPHA,
  bakePhoto,
  codigoSource,
  footerHeightPx,
} from "../lib/bake-photo";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Lado do quadrado do selo como fração da largura da foto. Teto em 50%: acima
 * disso ele começa a cobrir a própria ação fotografada. */
const MIN_SCALE = 0.1;
const MAX_SCALE = 0.5;

// A prévia usa as MESMAS constantes do bake-photo (importadas, não copiadas),
// para logo e tarja saírem no lugar e no tamanho em que serão gravadas.

/**
 * Mantém o selo fora do rodapé e da logo.
 *
 * Antes o arraste ia até a borda e o selo acabava por cima do nome/data ou da
 * assinatura — e como ele é desenhado por último, encobria as duas. Aqui as
 * zonas ocupadas viram limite: o selo esbarra nelas em vez de invadi-las.
 *
 * Tudo em fração: `x`/lado sobre a LARGURA, `y` sobre a ALTURA. `aspect` é
 * largura/altura da foto, o fator que converte um pelo outro.
 */
function clampPosition(
  x: number,
  y: number,
  scale: number,
  boxWidth: number,
  boxHeight: number,
  lineCount: number,
) {
  const aspect = boxWidth / boxHeight;
  const sealHeight = scale * aspect;

  const footer = footerHeightPx(boxWidth, lineCount) / boxHeight;
  const brandBottom =
    (BRAND_WIDTH_RATIO * BRAND_ASPECT + BRAND_PAD_RATIO * 2) * aspect;
  const brandLeft = 1 - BRAND_WIDTH_RATIO - BRAND_PAD_RATIO * 2;

  const nextX = clamp(x, 0, Math.max(0, 1 - scale));
  let nextY = clamp(y, 0, Math.max(0, 1 - sealHeight - footer));

  // Faixa da logo (topo, à direita). Empurrar para baixo preserva a posição
  // horizontal que o promotor escolheu; só quando não há altura sobrando é que
  // ele é jogado para a esquerda da logo.
  if (nextY < brandBottom && nextX + scale > brandLeft) {
    if (brandBottom + sealHeight + footer <= 1) {
      nextY = brandBottom;
    } else {
      return { x: Math.max(0, brandLeft - scale), y: nextY };
    }
  }

  return { x: nextX, y: nextY };
}

// Editor do carimbo: mostra a foto, deixa arrastar a senha do mês e
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
  onBaked: (photoKey: string, sealMissing: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Começa à esquerda e abaixo da faixa da logo. O `onLoad` da prévia reajusta
  // com as medidas reais, que dependem do formato da foto.
  const [pos, setPos] = useState({ x: 0.05, y: 0.2, scale: 0.3 });
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragging = useRef(false);

  // Object URL criado dentro do efeito (uma por `file`): assim o double-invoke
  // do StrictMode em dev revoga só a URL descartada, nunca a que está em uso.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Mesma origem do que o `bakePhoto` vai ler (o proxy `/api/s3/image`), não a
  // URL pública do R2. Com duas fontes diferentes, a prévia podia mostrar o
  // código e o arquivo salvo sair sem ele — ou, como aconteceu, a prévia
  // quebrar enquanto a gravação funcionava.
  const codigoUrl = codigoKey ? codigoSource(codigoKey) : null;

  const lineCount = textLines.filter(Boolean).length;

  const moveTo = (clientX: number, clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setPos((prev) => ({
      ...prev,
      ...clampPosition(
        (clientX - box.left) / box.width - prev.scale / 2,
        (clientY - box.top) / box.height -
          (prev.scale * (box.width / box.height)) / 2,
        prev.scale,
        box.width,
        box.height,
        lineCount,
      ),
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
        toast.warning("A foto foi salva SEM a senha do mês", {
          description:
            "Não foi possível carregar a senha do mês desta indústria. Avise a coordenação.",
          duration: 10000,
        });
      }
      const baked = new File([blob], `promotor-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      const key = await uploadToR2(await compressImage(baked), true);
      onBaked(key, codigoFaltando);
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
        Arraste a senha do mês para o local da foto onde ela deve ficar. Nome,
        data e localização são carimbados no rodapé.
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
            onLoad={(event) => {
              const image = event.currentTarget;
              setPos((prev) => ({
                ...prev,
                ...clampPosition(
                  prev.x,
                  prev.y,
                  prev.scale,
                  image.clientWidth,
                  image.clientHeight,
                  lineCount,
                ),
              }));
            }}
            className="block max-h-[60vh] w-auto max-w-full"
          />
        )}

        {codigoUrl && (
          // Quadrado 1:1 translúcido espelhando o `bakePhoto`: a arte entra
          // CONTIDA nele (`object-contain`), nunca esticada.
          <div
            onPointerDown={(event) => {
              event.preventDefault();
              dragging.current = true;
            }}
            style={{
              position: "absolute",
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              width: `${pos.scale * 100}%`,
              aspectRatio: "1 / 1",
              backgroundColor: `rgba(255,255,255,${SEAL_BOX_ALPHA})`,
              cursor: "grab",
              touchAction: "none",
              // Acima do texto e da logo, igual ao `bakePhoto`, que desenha o
              // código por último. Sem isto a prévia mostraria o código
              // coberto pelas tarjas e o arquivo salvo mostraria o contrário.
              zIndex: 10,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image */}
            <img
              src={codigoUrl}
              alt="Senha do mês"
              draggable={false}
              className="size-full object-contain"
            />
          </div>
        )}

        {/* Assinatura TradeGram: só prévia. Quem grava de fato é o `drawBrand`
          do bake-photo. Mostrar aqui evita o promotor posicionar o código
          justamente em cima dela e só descobrir depois de salvar. */}
        <div
          className="pointer-events-none absolute"
          style={{
            right: `${BRAND_PAD_RATIO * 100}%`,
            top: `${BRAND_PAD_RATIO * 100}%`,
            width: `${BRAND_WIDTH_RATIO * 100}%`,
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: logo estática em public/ */}
          <img
            src="/tradegram-logo-dark.svg"
            alt=""
            onLoad={() => setBrandLoaded(true)}
            className={`w-full ${brandLoaded ? "" : "opacity-0"}`}
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
              Tamanho da senha
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
              setPos((prev) => {
                const scale = clamp(value, MIN_SCALE, MAX_SCALE);
                const box = containerRef.current?.getBoundingClientRect();
                // Crescer também pode empurrar o selo para dentro do rodapé ou
                // da logo, então o novo tamanho passa pelo mesmo limite do
                // arraste.
                if (!box) return { ...prev, scale };
                return {
                  scale,
                  ...clampPosition(
                    prev.x,
                    prev.y,
                    scale,
                    box.width,
                    box.height,
                    lineCount,
                  ),
                };
              })
            }
            aria-label="Tamanho da senha do mês"
          />
        </div>
      ) : (
        <p className="text-center text-xs text-amber-600">
          Esta indústria não tem senha do mês cadastrada — a foto será salva só
          com o texto.
        </p>
      )}

      {/* Botões fixos no rodapé do viewport: no celular a foto + slider já
        empurram Salvar pra fora da tela. Sticky garante que "Refazer" e
        "Salvar foto" fiquem sempre visíveis sem exigir scroll. `-mx-4`
        neutraliza o `px-4` do wrapper do App Promotor pra o fundo ir de
        borda a borda. `pb-[safe-area]` respeita a home bar do iOS. */}
      <div
        className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 pt-3 backdrop-blur"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
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
          Salvar na galeria
        </Button>
      </div>
    </div>
  );
}
