"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { Plus, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";

// Konva não roda no SSR (tenta `require("canvas")` no Node). Mesmo padrão dos
// stages do mapa: carrega só no cliente, e só quando há foto pra editar.
const PhotoHighlightEditor = dynamic(
  () =>
    import("./photo-highlight-editor").then((mod) => mod.PhotoHighlightEditor),
  { ssr: false },
);

interface MediaPhotoUploaderProps {
  value: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

// Igual ao MultiPhotoUploader das fotos de PDV, mas em vez de subir direto ao
// escolher o arquivo, abre o PhotoHighlightEditor pra traçar o destaque do
// espaço antes do upload. Só a versão final (destacada ou crua) vira uma chave.
export function MediaPhotoUploader({
  value,
  onChange,
  disabled,
}: MediaPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const removeAt = (index: number) => {
    onChange(value.filter((_, current) => current !== index));
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {value.map((key, index) => (
          <div
            key={key}
            className="group relative aspect-square overflow-hidden rounded-md border"
          >
            <Image
              src={constructUrl(key)}
              alt="Foto modelo"
              fill
              sizes="120px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remover foto"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          aria-label="Adicionar foto"
        >
          <Plus className="size-5" />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setPendingFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {pendingFile && (
        <PhotoHighlightEditor
          file={pendingFile}
          onSaved={(key) => onChange([...value, key])}
          onOpenChange={(open) => {
            if (!open) setPendingFile(null);
          }}
        />
      )}
    </>
  );
}
