"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useGalleryDrafts,
  useSubmitGalleryPhotos,
} from "../hooks/use-promotor";

// Picker da "Galeria App": mostra os rascunhos in-app do promotor (não enviados)
// da loja+indústria atuais. Ele seleciona e envia pra fila da coordenadora.
export function GalleryPicker({
  open,
  onOpenChange,
  storeId,
  supplierId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  supplierId: string;
  onSubmitted: () => void;
}) {
  const { photos, isLoading } = useGalleryDrafts({ storeId, supplierId }, open);
  const submit = useSubmitGalleryPhotos();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const send = () => {
    if (selected.size === 0) return;
    submit.mutate(
      { photoIds: [...selected] },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.submitted} foto(s) enviada(s) para aprovação`,
          );
          setSelected(new Set());
          onSubmitted();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Galeria App</DialogTitle>
          <DialogDescription>
            Fotos que você tirou no app e ainda não enviou. Selecione e envie
            para a aprovação da coordenação.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : photos.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma foto na galeria para este cliente e indústria. Tire uma foto
            para começar.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => {
              const isSelected = selected.has(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className={`relative aspect-square overflow-hidden rounded-md border transition-shadow ${
                    isSelected
                      ? "ring-2 ring-primary"
                      : "hover:ring-2 hover:ring-primary/50"
                  }`}
                >
                  {/* biome-ignore lint/performance/noImgElement: thumbnail de key do R2 */}
                  <img
                    src={constructUrl(photo.photoKey)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                  {photo.possibleReuse && (
                    <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-semibold text-white">
                      <AlertTriangle className="size-2.5" /> reuso?
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {photos.length > 0 && (
          <Button
            type="button"
            className="h-11 w-full gap-2"
            disabled={selected.size === 0 || submit.isPending}
            onClick={send}
          >
            {submit.isPending ? <Spinner /> : <Check className="size-4" />}
            Enviar {selected.size > 0 ? `${selected.size} ` : ""}para aprovação
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
