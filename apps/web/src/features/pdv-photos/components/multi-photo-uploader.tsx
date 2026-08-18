"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { PhotoCaptureInput } from "./photo-capture-input";

interface MultiPhotoUploaderProps {
  value: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

export function MultiPhotoUploader({
  value,
  onChange,
  disabled,
}: MultiPhotoUploaderProps) {
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadingCount((count) => count + files.length);
    try {
      // allSettled e não all: com `all`, uma foto que falha no 4G do
      // supermercado descarta as que já subiram — o promotor perde o lote
      // inteiro e ainda deixa os objetos órfãos no R2.
      const results = await Promise.allSettled(
        files.map(async (file) => uploadToR2(await compressImage(file))),
      );

      const keys = results
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);

      if (keys.length > 0) onChange([...value, ...keys]);

      const failed = results.length - keys.length;
      if (failed > 0) {
        toast.error(
          keys.length > 0
            ? `${failed} de ${results.length} fotos não subiram. As demais foram salvas.`
            : "Falha ao enviar fotos",
        );
      }
    } finally {
      setUploadingCount((count) => Math.max(0, count - files.length));
    }
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, current) => current !== index));
  };

  return (
    <div className="space-y-3">
      {(value.length > 0 || uploadingCount > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((key, index) => (
            <div
              key={key}
              className="group relative aspect-square overflow-hidden rounded-md border"
            >
              <Image
                src={constructUrl(key)}
                alt="Foto do PDV"
                fill
                sizes="120px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                // Sempre visível no mobile: não existe hover em toque, e sem
                // isso a foto fica impossível de remover no celular.
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white transition md:p-1 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Remover foto"
              >
                <X className="size-3.5 md:size-3" />
              </button>
            </div>
          ))}

          {Array.from({ length: uploadingCount }).map((_, index) => (
            <div
              key={`uploading-${index}`}
              className="flex aspect-square items-center justify-center rounded-md border"
            >
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      <PhotoCaptureInput
        onFiles={handleFiles}
        disabled={disabled}
        isUploading={uploadingCount > 0}
      />
    </div>
  );
}
