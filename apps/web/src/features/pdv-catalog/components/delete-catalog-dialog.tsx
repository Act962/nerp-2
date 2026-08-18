"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteTradeCatalog } from "../hooks/use-trade-catalog-doc";

interface DeleteCatalogDialogProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteCatalogDialog({
  id,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCatalogDialogProps) {
  const deleteCatalog = useDeleteTradeCatalog();

  const handleDelete = () => {
    if (!id) return;
    deleteCatalog.mutate(
      { id },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir catálogo</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir este catálogo? Esta ação não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCatalog.isPending}
          >
            {deleteCatalog.isPending && <Spinner />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
