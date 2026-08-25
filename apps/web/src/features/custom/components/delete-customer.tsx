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
import { useDeleteCustomer } from "../hooks/use-customer";

interface DeleteCustomerProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteCustomer = ({
  id,
  open,
  onOpenChange,
}: DeleteCustomerProps) => {
  const deleteCustomer = useDeleteCustomer();

  const handleDelete = () => {
    if (!id) return;
    deleteCustomer.mutate(
      { id },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar cliente</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja deletar este cliente?
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
