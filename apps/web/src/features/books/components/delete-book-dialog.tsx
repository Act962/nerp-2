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
import { useDeleteBook } from "../hooks/use-books";

interface DeleteBookDialogProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteBookDialog({
  id,
  open,
  onOpenChange,
  onDeleted,
}: DeleteBookDialogProps) {
  const deleteBook = useDeleteBook();

  const handleDelete = () => {
    if (!id) return;
    deleteBook.mutate(
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
          <DialogTitle>Excluir book</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir este book? Esta ação não pode ser
            desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteBook.isPending}
          >
            {deleteBook.isPending && <Spinner />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
