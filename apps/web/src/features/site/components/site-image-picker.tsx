"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { constructUrl } from "@/hooks/use-construct-url";
import { UploadError, uploadToR2 } from "@/lib/upload-to-r2";
import { useRegisterMedia, useSiteMedia } from "../hooks/use-site-admin";

/**
 * Escolhe uma imagem: envia uma nova ou reaproveita uma que já está na Mídia.
 *
 * O arquivo vai direto para o R2 pela URL presignada — o mesmo caminho que o
 * resto do nerp usa. SVG não é aceito de propósito: o bucket é servido por URL
 * pública, e SVG é documento que executa script (ver a lista fechada em
 * `/api/s3/upload`).
 */
export function SiteImagePicker({
  value,
  onChange,
  label = "Imagem",
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { media } = useSiteMedia();
  const register = useRegisterMedia();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const key = await uploadToR2(file, true);
      await register.mutateAsync({
        key,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        width: null,
        height: null,
        alt: "",
      });
      onChange(key);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof UploadError
          ? error.message
          : "Não foi possível enviar a imagem",
      );
    } finally {
      setUploading(false);
    }
  }

  const preview = constructUrl(value);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {/* biome-ignore lint/performance/noImgElement: a key pode vir de
              qualquer host do bucket e o <Image> exigiria remotePatterns
              conhecidos; aqui é uma miniatura de admin. */}
          <img
            src={preview}
            alt=""
            className="size-16 rounded-md object-cover"
          />
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {value}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            aria-label="Remover imagem"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {value ? "Trocar imagem" : "Escolher imagem"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Imagem</DialogTitle>
          </DialogHeader>

          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span className="font-medium text-foreground">
              {uploading ? "Enviando…" : "Enviar uma imagem"}
            </span>
            <span className="text-xs">PNG, JPG, WebP ou AVIF — até 15 MB</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </label>

          {media.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              <p className="pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Já na mídia
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="overflow-hidden rounded-lg border transition-colors hover:border-primary"
                    onClick={() => {
                      onChange(item.key);
                      setOpen(false);
                    }}
                  >
                    {/* biome-ignore lint/performance/noImgElement: idem acima. */}
                    <img
                      src={constructUrl(item.key)}
                      alt={item.alt ?? ""}
                      className="aspect-4/3 w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
