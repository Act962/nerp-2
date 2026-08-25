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
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useClaimDirectoryCompany } from "../hooks/use-directory";

export function DirectoryClaimDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
}: {
  companyId: string;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const claim = useClaimDirectoryCompany();
  const [claimantRole, setClaimantRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [document, setDocument] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setClaimantRole("");
    setContactEmail("");
    setDocument("");
    setNotes("");
  }, [open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    claim.mutate(
      {
        companyId,
        claimantRole: claimantRole.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        document: document.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.status === "APROVADA") {
            toast.success(
              result.alreadyMine
                ? "Esta empresa já é da sua organização"
                : "Empresa reivindicada! Agora é da sua organização.",
            );
          } else {
            toast.warning(
              "Empresa já tem dono. Sua reivindicação foi registrada como contestação.",
            );
          }
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reivindicar {companyName}</DialogTitle>
          <DialogDescription>
            Confirme que você representa esta empresa. Se ela estiver livre,
            passa a ser administrada pela sua organização.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="claim-role">Seu cargo na empresa</Label>
            <Input
              id="claim-role"
              value={claimantRole}
              onChange={(event) => setClaimantRole(event.target.value)}
              placeholder="Ex.: Sócio, Gerente de Trade"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="claim-email">E-mail corporativo</Label>
              <Input
                id="claim-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="voce@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claim-doc">CNPJ</Label>
              <Input
                id="claim-doc"
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-notes">Observações</Label>
            <Textarea
              id="claim-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={claim.isPending}>
              {claim.isPending && <Spinner />}
              Reivindicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
