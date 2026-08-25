"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { ImagePlus, Store as StoreIcon, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSetStoreLogo } from "../hooks/use-mapa-de-campo";

export interface StoreLogoTarget {
  id: string;
  name: string;
  coverImageKey: string | null;
}

/**
 * Logo do cliente direto do pino.
 *
 * O OpenStreetMap não tem logo de loja, então todo cliente importado nasce como
 * bolinha. Sem um caminho curto daqui, dar rosto a dezenas de pinos viraria
 * dezenas de idas até o cadastro em /lojas.
 */
export function StoreLogoDialog({
  store,
  open,
  onOpenChange,
}: {
  store: StoreLogoTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = useSetStoreLogo();
  const busy = uploading || save.isPending;

  useEffect(() => {
    if (open) setFile(null);
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!store) return null;

  const current = store.coverImageKey
    ? constructUrl(store.coverImageKey)
    : null;
  const shown = preview ?? current;

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    let key: string;
    try {
      key = await uploadToR2(await compressImage(file), true);
    } catch {
      setUploading(false);
      toast.error("Não foi possível enviar a imagem, tente novamente");
      return;
    }
    setUploading(false);
    save.mutate(
      { id: store.id, coverImageKey: key },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Logo de {store.name}</DialogTitle>
          <DialogDescription>
            Vira a arte do pino no mapa, no lugar da bolinha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
            {shown ? (
              // biome-ignore lint/performance/noImgElement: preview local e URL do R2
              <img src={shown} alt="" className="size-full object-cover" />
            ) : (
              <StoreIcon className="size-7 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {shown ? "Escolher outra" : "Escolher imagem"}
            </Button>
            {store.coverImageKey && !file && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive"
                disabled={busy}
                onClick={() =>
                  save.mutate(
                    { id: store.id, coverImageKey: null },
                    { onSuccess: () => onOpenChange(false) },
                  )
                }
              >
                <Trash2 className="size-4" /> Remover
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={busy || !file} onClick={submit}>
            {busy && <Spinner />}
            {uploading ? "Enviando…" : "Salvar logo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
