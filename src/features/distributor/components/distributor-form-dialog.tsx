"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useCreateDistributor,
  useUpdateDistributor,
} from "../hooks/use-distributor";

export interface DistributorFormValues {
  id?: string;
  name: string;
  document?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
}

export function DistributorFormDialog({
  distributor,
  open,
  onOpenChange,
}: {
  distributor: DistributorFormValues | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateDistributor();
  const update = useUpdateDistributor();
  const isEdit = Boolean(distributor?.id);

  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(distributor?.name ?? "");
    setDocument(distributor?.document ?? "");
    setContactName(distributor?.contactName ?? "");
    setContactPhone(distributor?.contactPhone ?? "");
    setContactEmail(distributor?.contactEmail ?? "");
    setIsActive(distributor?.isActive ?? true);
  }, [open, distributor]);

  const isPending = create.isPending || update.isPending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Informe o nome do distribuidor");
      return;
    }
    const payload = {
      name: name.trim(),
      document: document.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      isActive,
    };
    const onDone = {
      onSuccess: () => {
        toast.success(
          isEdit ? "Distribuidor atualizado" : "Distribuidor criado",
        );
        onOpenChange(false);
      },
      onError: (error: Error) => toast.error(error.message),
    };
    if (isEdit && distributor?.id) {
      update.mutate({ id: distributor.id, ...payload }, onDone);
    } else {
      create.mutate(payload, onDone);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar distribuidor" : "Novo distribuidor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dist-name">Nome *</Label>
            <Input
              id="dist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do distribuidor"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dist-document">CNPJ</Label>
            <Input
              id="dist-document"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dist-contact-name">Contato</Label>
            <Input
              id="dist-contact-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Nome do responsável"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dist-phone">Telefone</Label>
              <Input
                id="dist-phone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dist-email">E-mail</Label>
              <Input
                id="dist-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="contato@distribuidora.com"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="dist-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="dist-active">Ativo</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
