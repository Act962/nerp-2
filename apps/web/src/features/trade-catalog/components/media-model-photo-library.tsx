"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { Lock, Plus, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  useCreateMediaModelPhoto,
  useDeleteMediaModelPhoto,
  useIsSuperAdmin,
  useMediaModelPhotos,
} from "../hooks/use-media-model-photos";

// Konva não roda no SSR (tenta `require("canvas")` no Node) — carrega só no
// cliente, e só quando há foto pra editar.
const PhotoHighlightEditor = dynamic(
  () =>
    import("./photo-highlight-editor").then((mod) => mod.PhotoHighlightEditor),
  { ssr: false },
);

interface MediaModelPhotoLibraryProps {
  code: string;
}

// Biblioteca Órbita GLOBAL desta mídia (por código). Todos veem; só o
// super-admin adiciona/remove. Fica separada das fotos da própria org.
export function MediaModelPhotoLibrary({ code }: MediaModelPhotoLibraryProps) {
  const isSuperAdmin = useIsSuperAdmin();
  const { photos } = useMediaModelPhotos();
  const create = useCreateMediaModelPhoto();
  const remove = useDeleteMediaModelPhoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const codePhotos = photos.filter((photo) => photo.code === code);

  if (!isSuperAdmin && codePhotos.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        Sem fotos oficiais do Órbita para esta mídia ainda.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {codePhotos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square overflow-hidden rounded-md border"
          >
            <Image
              src={constructUrl(photo.imageKey)}
              alt="Foto modelo Órbita"
              fill
              sizes="120px"
              className="object-cover"
            />
            {isSuperAdmin && (
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: photo.id })}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remover foto"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground transition hover:border-primary hover:text-primary"
            aria-label="Adicionar foto oficial"
          >
            <Plus className="size-5" />
          </button>
        )}

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
          onSaved={(imageKey) => create.mutate({ code, imageKey })}
          onOpenChange={(open) => {
            if (!open) setPendingFile(null);
          }}
        />
      )}
    </>
  );
}
