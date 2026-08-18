"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, X } from "lucide-react";
import { constructUrl } from "@/hooks/use-construct-url";

interface BackgroundImageUploaderProps {
  value: string;
  onChange: (key: string) => void;
}

export function BackgroundImageUploader({ value, onChange }: BackgroundImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const previewUrl = value ? constructUrl(value) : null;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const presignedRes = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!presignedRes.ok) throw new Error("Falha ao obter URL de upload");
      const { presignedUrl, key } = await presignedRes.json();

      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Falha ao enviar arquivo");

      onChange(key);
    } catch {
      // silently ignore — user can retry
    } finally {
      setUploading(false);
    }
  }

  return (
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

      {previewUrl ? (
        <div className="relative rounded overflow-hidden border aspect-video bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Fundo" className="w-full h-full object-cover" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 rounded border border-dashed p-4 text-muted-foreground hover:bg-muted/50 transition-colors text-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
          {uploading ? "Enviando..." : "Clique para enviar imagem de fundo"}
        </button>
      )}

      {previewUrl && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Trocar imagem
        </Button>
      )}
    </div>
  );
}
