"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { MediaTypeSelect } from "@/features/trade-catalog/components/media-type-select";
import { useApprovedForImport } from "@/features/promotor/hooks/use-promotor";
import { useDeletePdvPhoto } from "@/features/pdv-photos/hooks/use-pdv-photos";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

// "Fotos desta loja/cliente" — gerencia as fotos aprovadas da loja do book:
// filtro por tipo de mídia, selecionar todas e excluir. Modelo do popup
// "Adicionar foto". Vale para páginas auto e manuais.
interface BookStorePhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  storeId: string;
  supplierId: string | null;
  storeName: string;
}

export function BookStorePhotosDialog({
  open,
  onOpenChange,
  bookId,
  storeId,
  supplierId,
  storeName,
}: BookStorePhotosDialogProps) {
  const { photos, isLoading } = useApprovedForImport(
    storeId || undefined,
    supplierId ?? undefined,
    open && !!storeId,
    bookId,
  );
  const deletePhoto = useDeletePdvPhoto();
  const [mediaFilter, setMediaFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () =>
      mediaFilter
        ? photos.filter((p) => p.mediaTypeId === mediaFilter)
        : photos,
    [photos, mediaFilter],
  );

  const allSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelected = async () => {
    for (const id of [...selected]) {
      await deletePhoto.mutateAsync({ id });
    }
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fotos desta loja — {storeName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <MediaTypeSelect
            value={mediaFilter}
            onChange={setMediaFilter}
            placeholder="Filtrar por mídia"
          />
          <span className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Selecionar todas as fotos"
            />
            Selecionar todas ({visible.length})
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto gap-1"
            disabled={selected.size === 0 || deletePhoto.isPending}
            onClick={deleteSelected}
          >
            {deletePhoto.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Excluir selecionadas ({selected.size})
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma foto{mediaFilter ? " deste tipo de mídia" : ""} para esta
              loja.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {visible.map((photo) => (
                <button
                  type="button"
                  key={photo.id}
                  onClick={() => toggle(photo.id)}
                  className={`relative overflow-hidden rounded-lg border text-left ${
                    selected.has(photo.id) ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="absolute left-1.5 top-1.5 z-10">
                    <Checkbox
                      checked={selected.has(photo.id)}
                      className="border-white bg-white/90"
                    />
                  </div>
                  {/* biome-ignore lint/performance/noImgElement: thumbnail da foto */}
                  <img
                    src={constructUrl(photo.photoKey)}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {photo.mediaType && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
                      {photo.mediaType.code}
                    </span>
                  )}
                  {photo.usedInBook && (
                    <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 py-0.5 text-[10px] font-semibold text-white">
                      No book
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
