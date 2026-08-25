"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { avatarColorFor, initialsFor } from "../lib/avatar-color";

const MAX_SIZE = 2 * 1024 * 1024;

// Uploader circular compacto pra foto do participante no assistente. Guarda
// a CHAVE do S3 (não a URL) via value/onChange, no mesmo padrão do
// LogoUploader — a URL só é construída pra preview.
export function SalesGoalPhotoUploader({
  value,
  onChange,
  name,
  seed,
  size = 40,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  name: string;
  seed: string;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = value ? constructUrl(value) : null;
  const color = avatarColorFor(seed);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Imagem muito grande, máximo de 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const presignedResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!presignedResponse.ok) throw new Error("presign");
      const { presignedUrl, key } = await presignedResponse.json();

      const putResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) throw new Error("put");

      onChange(key);
      toast.success("Foto enviada.");
    } catch {
      toast.error("Falha ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={previewUrl ? "Trocar foto" : "Enviar foto"}
        className={cn(
          "group relative flex size-full items-center justify-center overflow-hidden rounded-full border text-white transition-colors",
          previewUrl
            ? "border-transparent"
            : "border-dashed border-muted-foreground/40 hover:border-muted-foreground/70",
        )}
        style={
          previewUrl
            ? undefined
            : {
                background: `radial-gradient(circle at 35% 35%, ${color}, ${color}55)`,
              }
        }
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : previewUrl ? (
          // biome-ignore lint/performance/noImgElement: preview de chave S3 arbitrária, fora do domínio otimizado do next/image
          <img src={previewUrl} alt={name} className="size-full object-cover" />
        ) : name.trim() ? (
          <span className="font-bold" style={{ fontSize: size * 0.34 }}>
            {initialsFor(name)}
          </span>
        ) : (
          <Upload className="size-4 opacity-80" />
        )}
        {!uploading && previewUrl && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Upload className="size-4" />
          </span>
        )}
      </button>

      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Remover foto"
          className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-background bg-destructive text-destructive-foreground"
        >
          <X className="size-2.5" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
