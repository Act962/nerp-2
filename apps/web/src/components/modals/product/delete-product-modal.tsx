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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useProductModal } from "@/hooks/modals/use-product-modal";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function DeleteProductModal() {
  const queryClient = useQueryClient();
  const { open, onClose, product, onSucess } = useProductModal();
  const [productName, setProductName] = useState("");

  const deleteProduct = useMutation(
    orpc.products.delete.mutationOptions({
      onSuccess: (data) => {
        onClose();
        onSucess?.();
        queryClient.invalidateQueries({
          queryKey: orpc.products.list.key(),
        });
        return toast.success(
          `Produto ${data.productName} excluído com sucesso`,
        );
      },
      onError: (error) => {
        return toast.error(error.message);
      },
    }),
  );

  const onDelete = () => {
    if (!product) {
      return;
    }
    deleteProduct.mutate({
      productId: product.id,
    });
  };

  useEffect(() => {
    if (!open) {
      setProductName("");
    }
  }, [open]);

  const isDeletingProduct = deleteProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar Produto</DialogTitle>
          <DialogDescription>
            Tem certeza de que deseja excluir o produto{" "}
            <strong>{product?.name}?</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="productName">
            Digite o nome do produto para confirmar
          </Label>
          <Input
            id="productName"
            value={productName}
            disabled={isDeletingProduct}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={product?.name || "Nome do Produto"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={productName !== product?.name || isDeletingProduct}
            variant="destructive"
            onClick={onDelete}
          >
            {isDeletingProduct && <Spinner />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
