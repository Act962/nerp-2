import { useCreateProductsModal } from "@/hooks/modals/use-create-products";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

export default function CreateProductModal() {
  const { open, onClose } = useCreateProductsModal();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Produto</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
