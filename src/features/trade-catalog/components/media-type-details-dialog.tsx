"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { useMediaTypes, useUpdateMediaType } from "../hooks/use-trade-catalog";
import { MediaModelPhotoLibrary } from "./media-model-photo-library";
import { MediaPhotoUploader } from "./media-photo-uploader";

interface MediaTypeDetailsDialogProps {
  mediaTypeId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function MediaTypeDetailsDialog({
  mediaTypeId,
  onOpenChange,
}: MediaTypeDetailsDialogProps) {
  const { mediaTypes } = useMediaTypes({ includeInactive: true });
  const mediaType = mediaTypes.find((item) => item.id === mediaTypeId);
  const update = useUpdateMediaType();

  const [description, setDescription] = useState("");
  const [examplesText, setExamplesText] = useState("");
  const [occupancyRules, setOccupancyRules] = useState("");
  const [defaultPhotos, setDefaultPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!mediaType) return;
    setDescription(mediaType.description ?? "");
    setExamplesText(mediaType.examples.join(", "));
    setOccupancyRules(mediaType.occupancyRules ?? "");
    setDefaultPhotos(mediaType.defaultPhotos);
  }, [mediaType]);

  const handleSave = () => {
    if (!mediaType) return;
    update.mutate(
      {
        id: mediaType.id,
        description: description.trim() || null,
        examples: examplesText
          .split(",")
          .map((example) => example.trim())
          .filter(Boolean),
        occupancyRules: occupancyRules.trim() || null,
        defaultPhotos,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={!!mediaType} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes · {mediaType?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mediaType && (
            <Field>
              <FieldLabel>
                Fotos modelo do Órbita (biblioteca global)
              </FieldLabel>
              <MediaModelPhotoLibrary code={mediaType.code} />
            </Field>
          )}

          <Field>
            <FieldLabel>Fotos da sua organização</FieldLabel>
            <MediaPhotoUploader
              value={defaultPhotos}
              onChange={setDefaultPhotos}
              disabled={update.isPending}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="media-type-description">Descrição</FieldLabel>
            <Textarea
              id="media-type-description"
              value={description}
              rows={3}
              placeholder="O que é essa mídia, onde costuma ficar na loja..."
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="media-type-examples">
              Exemplos (separados por vírgula)
            </FieldLabel>
            <Textarea
              id="media-type-examples"
              value={examplesText}
              rows={2}
              placeholder="Ex.: display de chão, cesto aramado"
              onChange={(event) => setExamplesText(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="media-type-occupancy">
              Regras de ocupação
            </FieldLabel>
            <Textarea
              id="media-type-occupancy"
              value={occupancyRules}
              rows={3}
              placeholder="Como montar/apresentar esse tipo de mídia"
              onChange={(event) => setOccupancyRules(event.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={update.isPending}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
