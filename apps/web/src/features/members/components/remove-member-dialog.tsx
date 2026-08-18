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
import { useRemoveMember } from "../hooks/use-members";

interface RemoveMemberDialogProps {
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveMemberDialog({
  memberId,
  memberName,
  open,
  onOpenChange,
}: RemoveMemberDialogProps) {
  const removeMember = useRemoveMember();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover membro</DialogTitle>
          <DialogDescription>
            Remover <strong>{memberName}</strong> da organização? A pessoa perde
            o acesso imediatamente. Você pode convidá-la novamente depois.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={removeMember.isPending}
            onClick={() =>
              removeMember.mutate(
                { memberId },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {removeMember.isPending && <Spinner />}
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
