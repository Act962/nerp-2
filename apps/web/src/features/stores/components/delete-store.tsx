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
import { useDeleteStore } from "../hooks/use-stores";

interface DeleteStoreProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteStore({ id, open, onOpenChange }: DeleteStoreProps) {
  const deleteStore = useDeleteStore();

  const handleDelete = () => {
    if (!id) return;
    deleteStore.mutate({ id }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir loja</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir esta loja? Os mapas, PDVs e fotos
            vinculados também serão removidos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteStore.isPending}
          >
            {deleteStore.isPending && <Spinner />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
