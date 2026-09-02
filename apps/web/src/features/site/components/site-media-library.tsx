"use client";

import { useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import { UploadError, uploadToR2 } from "@/lib/upload-to-r2";
import {
  useRegisterMedia,
  useRemoveMedia,
  useSiteMedia,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

/** Quantos KB/MB, para a legenda de cada imagem. */
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SiteMediaLibrary() {
  const { media, isLoading } = useSiteMedia();
  const register = useRegisterMedia();
  const remove = useRemoveMedia();
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
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
      }
      toast.success("Imagens enviadas");
    } catch (error) {
      toast.error(
        error instanceof UploadError
          ? error.message
          : "Não foi possível enviar",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <SitePageHeader
        title="Mídia"
        description="As imagens do site. Ficam no mesmo storage que o resto do nerp usa."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted/40">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span className="font-medium text-foreground">
              {uploading
                ? "Enviando…"
                : "Arraste imagens ou clique para enviar"}
            </span>
            <span className="text-xs">
              PNG, JPG, WebP ou AVIF — até 15 MB cada. SVG não é aceito: o
              bucket é público e um SVG pode executar script.
            </span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                if (event.target.files?.length) {
                  void handleFiles(event.target.files);
                }
                event.target.value = "";
              }}
            />
          </label>

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : media.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma imagem ainda.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <figure key={item.id} className="group relative">
                  {/* biome-ignore lint/performance/noImgElement: miniatura de admin, key de bucket. */}
                  <img
                    src={constructUrl(item.key)}
                    alt={item.alt ?? item.fileName}
                    className="aspect-4/3 w-full rounded-lg border object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={`Remover ${item.fileName} da lista`}
                    className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => remove.mutate({ id: item.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <figcaption className="mt-1 truncate text-xs text-muted-foreground">
                    {item.fileName} · {humanSize(item.size)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
