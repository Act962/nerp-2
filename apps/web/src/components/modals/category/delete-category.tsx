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
import { useCategoryModal } from "@/hooks/modals/use-category-modal";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function DeleteCategoryDialog() {
  const queryClient = useQueryClient();
  const { openDelete, onCloseDelete, category } = useCategoryModal();

  const deleteCategoryMutation = useMutation(
    orpc.categories.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.categories.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.categories.listWithoutSubcategory.queryKey(),
        });

        toast.success("Categoria deletada com sucesso");
        onCloseDelete();
      },
      onError: () => {
        toast.error("Erro ao deletar categoria");
      },
    })
  );

  const onDelete = async () => {
    if (!category?.id) return;

    deleteCategoryMutation.mutate({
      id: category.id,
    });
  };

  return (
    <Dialog open={openDelete} onOpenChange={onCloseDelete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar Categoria</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja deletar a categoria "{category?.name}"?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCloseDelete}>
            Cancelar
          </Button>
          <Button onClick={onDelete} variant="destructive">
            Deletar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
