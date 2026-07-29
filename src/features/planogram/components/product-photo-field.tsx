"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { AlertTriangle, Scissors, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  useNormalizeProductPhoto,
  useRecutProductPhoto,
} from "../hooks/use-product-photo";

interface PhotoResult {
  thumbnail: string;
  widthPx: number;
  heightPx: number;
  status: "OK" | "SUSPECT";
  reason?: string;
  keyedBackground: boolean;
  /** Só o recorte da foto atual pode terminar sem gravar nada. */
  applied?: boolean;
}

interface ProductPhotoFieldProps {
  productId: string;
  /** Thumbnail atual do cadastro, se houver. */
  currentThumbnail: string | null;
  /** Medidas digitadas, para comparar a proporção com a da foto recortada. */
  widthMm: number | null;
  heightMm: number | null;
  /** Chave do recorte recém-gravado — o editor precisa dela para repintar. */
  onPhotoChange: (thumbnail: string) => void;
}

/** Acima disso a foto e a medida discordam a ponto de valer um aviso. */
const RATIO_DRIFT_LIMIT = 1.35;

export function ProductPhotoField({
  productId,
  currentThumbnail,
  widthMm,
  heightMm,
  onPhotoChange,
}: ProductPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  // Proporção da foto que está na tela agora, mesmo sem nenhuma ação nesta
  // sessão — é o que permite avisar sobre medida errada em produto que veio do
  // catálogo, em vez de só depois de um envio.
  const [previewRatio, setPreviewRatio] = useState<number | null>(null);
  const { upload, isPending: isUploading } = useNormalizeProductPhoto();
  const { recut, isPending: isRecutting } = useRecutProductPhoto();
  const isPending = isUploading || isRecutting;

  const previewKey = result?.thumbnail ?? currentThumbnail;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const uploaded = await upload(productId, file);
      setResult(uploaded);
      setPreviewRatio(null);
      onPhotoChange(uploaded.thumbnail);
      if (uploaded.status === "SUSPECT") {
        toast.warning("Foto salva, mas sem recorte", {
          description: uploaded.reason,
        });
      } else {
        toast.success(
          uploaded.keyedBackground
            ? "Fundo removido e foto recortada"
            : "Foto recortada",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao enviar a foto",
      );
    }
  }

  async function handleRecut() {
    try {
      const recutResult = await recut({ productId });
      setResult(recutResult);
      setPreviewRatio(null);
      if (!recutResult.applied) {
        toast.warning("Foto mantida como está", {
          description: recutResult.reason,
        });
        return;
      }
      onPhotoChange(recutResult.thumbnail);
      toast.success(
        recutResult.keyedBackground
          ? "Fundo removido e foto recortada"
          : "Foto recortada",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao recortar a foto",
      );
    }
  }

  // A proporção do recorte deveria bater com a da embalagem. Divergir muito
  // quase sempre significa medida errada — é o momento de avisar, não depois.
  const photoRatio = result ? result.widthPx / result.heightPx : previewRatio;
  const boxRatio = widthMm && heightMm ? widthMm / heightMm : null;
  const hasRatioConflict =
    photoRatio != null &&
    boxRatio != null &&
    Math.abs(Math.log(photoRatio / boxRatio)) > Math.log(RATIO_DRIFT_LIMIT);

  return (
    <div className="space-y-2">
      <Label className="text-xs">Foto do produto</Label>

      <div className="flex gap-3">
        <div
          className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border"
          // Xadrez para a transparência do recorte ficar visível.
          style={{
            backgroundImage:
              "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)",
            backgroundSize: "12px 12px",
            backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
          }}
        >
          {isPending ? (
            <Spinner />
          ) : previewKey ? (
            // biome-ignore lint/performance/noImgElement: prévia de um recorte recém-gerado no R2; o next/image não acrescenta nada aqui
            <img
              src={constructUrl(previewKey)}
              alt="Prévia do recorte"
              className="max-h-full max-w-full object-contain"
              onLoad={(event) => {
                const image = event.currentTarget;
                setPreviewRatio(
                  image.naturalHeight > 0
                    ? image.naturalWidth / image.naturalHeight
                    : null,
                );
              }}
            />
          ) : (
            <span className="px-2 text-center text-[10px] text-muted-foreground">
              sem foto
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {previewKey ? "Trocar foto" : "Enviar foto"}
          </Button>

          {previewKey && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-2"
              disabled={isPending}
              onClick={handleRecut}
            >
              <Scissors className="size-4" />
              Recortar fundo da foto atual
            </Button>
          )}

          <p className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
            <Scissors className="mt-0.5 size-3 shrink-0" />O fundo é removido e
            a foto recortada até o contorno da embalagem — é isso que faz o
            produto assentar no tamanho certo da gôndola.
          </p>

          {result && result.applied !== false && (
            <p className="text-[10px] text-muted-foreground">
              Recorte: {result.widthPx}×{result.heightPx} px
              {result.keyedBackground ? " · fundo removido" : ""}
            </p>
          )}
        </div>
      </div>

      {result?.status === "SUSPECT" && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {result.reason}.{" "}
          {result.applied === false
            ? "A foto do cadastro foi mantida"
            : "A foto foi salva sem recorte"}{" "}
          — para recortar, use uma imagem com fundo liso.
        </p>
      )}

      {hasRatioConflict && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />A proporção da
          foto ({photoRatio?.toFixed(2)}) está longe da proporção das medidas
          digitadas ({boxRatio?.toFixed(2)}). Confira se a largura e a altura
          estão corretas.
        </p>
      )}
    </div>
  );
}
