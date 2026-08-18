"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import { Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  type PdvPhoto,
  type PdvPhotoFilters,
  useDeletePdvPhoto,
  usePdvPhotos,
} from "../hooks/use-pdv-photos";
import { PdvPhotoDialog } from "./pdv-photo-dialog";

interface PdvPhotoHistoryProps {
  filters: PdvPhotoFilters;
  enabled?: boolean;
  emptyText?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function PdvPhotoHistory({
  filters,
  enabled = true,
  emptyText = "Nenhuma foto do PDV registrada.",
}: PdvPhotoHistoryProps) {
  const { photos, isLoading } = usePdvPhotos(filters, enabled);
  const deletePhoto = useDeletePdvPhoto();
  const [editing, setEditing] = useState<PdvPhoto | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {photos.map((photo) => {
        const chips = [
          photo.section,
          photo.code,
          photo.actionValue != null
            ? photo.actionValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : null,
          photo.supplierName,
          photo.responsibleCompany,
          photo.coordinatorName && `Coord.: ${photo.coordinatorName}`,
          photo.consultantName && `Cons.: ${photo.consultantName}`,
        ].filter((value): value is string => !!value);

        return (
          <div key={photo.id} className="rounded-lg border p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-sm font-medium">
                  {formatDate(photo.capturedAt)}
                </span>
                {chips.map((chip) => (
                  <Badge key={chip} variant="secondary" className="font-normal">
                    {chip}
                  </Badge>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Editar"
                  onClick={() => setEditing(photo)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  title="Excluir"
                  onClick={() => deletePhoto.mutate({ id: photo.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photo.photos.map((key) => (
                <a
                  key={key}
                  href={constructUrl(key)}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-square overflow-hidden rounded-md border"
                >
                  <Image
                    src={constructUrl(key)}
                    alt="Foto do PDV"
                    fill
                    sizes="100px"
                    className="object-cover transition hover:scale-105"
                  />
                </a>
              ))}
            </div>
          </div>
        );
      })}

      {/* Sem mapObjectId: em modo edição o vínculo com o mapa é imutável —
          trocar de espaço é a ação `pdvPhoto.linkMapObject`. */}
      {editing && (
        <PdvPhotoDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          storeId={editing.storeId}
          photo={editing}
        />
      )}
    </div>
  );
}
