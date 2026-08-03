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
import { useDeleteSupplier } from "../hooks/use-supplier";

interface DeleteSupplierProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteSupplier = ({
  id,
  open,
  onOpenChange,
}: DeleteSupplierProps) => {
  const deleteSupplier = useDeleteSupplier();

  const handleDelete = () => {
    if (!id) return;
    deleteSupplier.mutate(
      { id },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar fornecedor</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja deletar este fornecedor?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete}>
            Deletar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
