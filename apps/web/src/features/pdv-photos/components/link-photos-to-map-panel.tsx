"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { useLinkPhotoToMapObject, usePdvPhotos } from "../hooks/use-pdv-photos";

interface LinkPhotosToMapPanelProps {
  storeId: string;
}

// Fotos tiradas em campo antes de a loja ter mapa ficam penduradas só na loja.
// Quando o mapa é desenhado, este painel é o caminho de ligá-las aos espaços.
export function LinkPhotosToMapPanel({ storeId }: LinkPhotosToMapPanelProps) {
  const { photos, isLoading } = usePdvPhotos({ storeId, unlinkedOnly: true });
  const { data: spacesData } = useQuery(
    orpc.mapObject.listSpaces.queryOptions({ input: { storeId, limit: 200 } }),
  );
  const linkPhoto = useLinkPhotoToMapObject();
  const [selectedSpaceByPhoto, setSelectedSpaceByPhoto] = useState<
    Record<string, string>
  >({});

  const spaces = spacesData?.items ?? [];

  if (isLoading) return null;
  if (photos.length === 0) return null;
  if (spaces.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fotos sem espaço no mapa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Estas fotos foram registradas antes do mapa existir. Escolha o espaço
          correspondente para vinculá-las.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {photos.map((photo) => {
          // Espaços da mesma mídia da foto sobem pro topo — sem isso, achar a
          // ponta de gôndola certa entre 40 espaços vira caça ao tesouro.
          const sortedSpaces = [...spaces].sort((a, b) => {
            const aMatches = photo.mediaTypeId
              ? a.mediaTypeId === photo.mediaTypeId
              : false;
            const bMatches = photo.mediaTypeId
              ? b.mediaTypeId === photo.mediaTypeId
              : false;
            if (aMatches === bMatches) return 0;
            return aMatches ? -1 : 1;
          });

          const selectedSpaceId = selectedSpaceByPhoto[photo.id] ?? "";

          return (
            <div
              key={photo.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
            >
              {photo.photos[0] ? (
                // biome-ignore lint/performance/noImgElement: preview simples de key do R2
                <img
                  src={constructUrl(photo.photos[0])}
                  alt=""
                  className="h-20 w-24 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-md border text-xs text-muted-foreground">
                  Sem foto
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {photo.mediaTypeName ??
                    photo.section ??
                    "Sem mídia informada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(photo.capturedAt).toLocaleDateString("pt-BR")}
                  {photo.code ? ` · ${photo.code}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={selectedSpaceId}
                  onValueChange={(value) =>
                    setSelectedSpaceByPhoto((current) => ({
                      ...current,
                      [photo.id]: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Escolher espaço" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedSpaces.map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.spaceCode ? `${space.spaceCode} — ` : ""}
                        {space.name ?? space.mediaType?.name ?? "Espaço"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  className="gap-2"
                  disabled={!selectedSpaceId || linkPhoto.isPending}
                  onClick={() =>
                    linkPhoto.mutate({
                      id: photo.id,
                      mapObjectId: selectedSpaceId,
                    })
                  }
                >
                  {linkPhoto.isPending ? (
                    <Spinner />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                  Vincular
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
