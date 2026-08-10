"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useCreatePdvMedia } from "../hooks/use-pdv-media";
import { type MediaValue, MediaUploader } from "./media-uploader";

interface PdvMediaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdvMediaFormDialog({
  open,
  onOpenChange,
}: PdvMediaFormDialogProps) {
  const [media, setMedia] = useState<MediaValue>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(8);
  const create = useCreatePdvMedia();

  function reset() {
    setMedia(null);
    setTitle("");
    setDuration(8);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!media) return;
    await create.mutateAsync({
      url: media.url,
      type: media.type,
      title: title.trim() || undefined,
      durationSeconds: media.type === "IMAGE" ? duration : undefined,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova mídia</DialogTitle>
          <DialogDescription>
            Imagem (JPG/PNG/WebP/GIF) ou vídeo (MP4) exibido no painel do PDV.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Arquivo</FieldLabel>
            <MediaUploader value={media} onChange={setMedia} />
            <FieldDescription>
              Tamanho recomendado: <strong>309 × 1200 px</strong> (vertical). A
              mídia é cortada nas bordas para preencher a faixa — deixe o
              essencial (logo, QR Code) centralizado.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="pdv-media-title">Título (opcional)</FieldLabel>
            <Input
              id="pdv-media-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Banner catálogo digital"
              maxLength={120}
            />
            <FieldDescription>
              Só para você identificar a mídia na lista.
            </FieldDescription>
          </Field>

          {media?.type !== "VIDEO" && (
            <Field>
              <FieldLabel htmlFor="pdv-media-duration">
                Tempo de exibição (segundos)
              </FieldLabel>
              <Input
                id="pdv-media-duration"
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(e) =>
                  setDuration(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <FieldDescription>
                Vídeos tocam até o fim — o tempo não se aplica.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!media || create.isPending}>
            {create.isPending && (
              <Loader2 className="mr-1 size-4 animate-spin" />
            )}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
