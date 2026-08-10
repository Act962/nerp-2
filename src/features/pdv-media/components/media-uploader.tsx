"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileVideo, ImageIcon, Loader2, X } from "lucide-react";
import { constructUrl } from "@/hooks/use-construct-url";
import { toast } from "sonner";

export type MediaValue = { url: string; type: "IMAGE" | "VIDEO" } | null;

interface MediaUploaderProps {
  value: MediaValue;
  onChange: (value: MediaValue) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

export function MediaUploader({ value, onChange }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const previewUrl = value ? constructUrl(value.url) : null;

  async function handleFile(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Envie uma imagem (JPG/PNG/WebP/GIF) ou vídeo (MP4).");
      return;
    }
    setUploading(true);
    try {
      const presignedRes = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          isImage,
        }),
      });
      if (!presignedRes.ok) {
        const body = await presignedRes.json().catch(() => null);
        throw new Error(body?.error ?? "Falha ao obter URL de upload");
      }
      const { presignedUrl, key } = await presignedRes.json();

      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Falha ao enviar arquivo");

      onChange({ url: key, type: isVideo ? "VIDEO" : "IMAGE" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha no upload da mídia",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="relative aspect-[9/16] max-h-64 w-full overflow-hidden rounded border bg-muted">
          {value?.type === "VIDEO" ? (
            // biome-ignore lint/a11y/useMediaCaption: mídia promocional muda
            <video
              src={previewUrl}
              className="h-full w-full object-cover"
              muted
              autoPlay
              loop
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Prévia da mídia"
              className="h-full w-full object-cover"
            />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-1 top-1 size-6"
            onClick={() => onChange(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 rounded border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <span className="flex gap-1">
              <ImageIcon className="size-5" />
              <FileVideo className="size-5" />
            </span>
          )}
          {uploading ? "Enviando..." : "Clique para enviar imagem ou vídeo"}
        </button>
      )}

      {previewUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading && <Loader2 className="mr-1 size-3 animate-spin" />}
          Trocar mídia
        </Button>
      )}
    </div>
  );
}
