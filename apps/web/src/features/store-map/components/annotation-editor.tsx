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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { MapAnnotationType } from "@/generated/prisma/enums";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ANNOTATION_META, ANNOTATION_TYPES } from "../engine/annotations";
import {
  type MapAnnotation,
  useDeleteAnnotation,
  useUpdateAnnotation,
} from "../hooks/use-map-annotations";

interface AnnotationEditorProps {
  annotation: MapAnnotation | null;
  onClose: () => void;
}

export function AnnotationEditor({
  annotation,
  onClose,
}: AnnotationEditorProps) {
  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();

  const [type, setType] = useState<MapAnnotationType>("PIN");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!annotation) return;
    setType(annotation.type);
    setText(annotation.text ?? "");
    setStatus(annotation.status ?? "");
  }, [annotation]);

  const handleSave = () => {
    if (!annotation) return;
    updateAnnotation.mutate(
      {
        id: annotation.id,
        type,
        text: text || null,
        status: status || null,
      },
      { onSuccess: onClose },
    );
  };

  const handleDelete = () => {
    if (!annotation) return;
    deleteAnnotation.mutate({ id: annotation.id }, { onSuccess: onClose });
  };

  return (
    <Dialog open={!!annotation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anotação no mapa</DialogTitle>
          <DialogDescription>
            Marque um ponto de atenção, pendência ou comentário na planta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select
              value={type}
              onValueChange={(value) => setType(value as MapAnnotationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNOTATION_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ANNOTATION_META[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="annotation-text">Descrição</FieldLabel>
            <Textarea
              id="annotation-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ex.: Falta reposição na gôndola de bebidas"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="annotation-status">Situação</FieldLabel>
            <Input
              id="annotation-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              placeholder="Ex.: Aberto, Em andamento, Resolvido"
            />
          </Field>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={handleDelete}
            disabled={deleteAnnotation.isPending}
          >
            <Trash2 className="size-4" />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={updateAnnotation.isPending}
            >
              {updateAnnotation.isPending && <Spinner />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
