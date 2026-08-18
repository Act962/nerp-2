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
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateTradegramInterest } from "../hooks/use-tradegram";

type InterestKind = "INTERESSE" | "FILA_ESPERA";

interface TradegramInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  storeId: string;
  mapObjectId?: string;
  kind: InterestKind;
  spaceCode?: string | null;
  spaceLabel?: string | null;
}

const COPY: Record<
  InterestKind,
  { title: string; description: string; submit: string; success: string }
> = {
  INTERESSE: {
    title: "Tenho interesse neste ponto",
    description:
      "Deixe seus dados. A loja recebe seu interesse e entra em contato para negociar o espaço.",
    submit: "Enviar interesse",
    success: "Interesse enviado! A loja vai entrar em contato.",
  },
  FILA_ESPERA: {
    title: "Entrar na fila de espera",
    description:
      "Este espaço está ocupado. Deixe seus dados e a loja avisa quando ele ficar disponível.",
    submit: "Entrar na fila",
    success: "Pronto! Você entrou na fila de espera deste ponto.",
  },
};

export function TradegramInterestDialog({
  open,
  onOpenChange,
  orgSlug,
  storeId,
  mapObjectId,
  kind,
  spaceCode,
  spaceLabel,
}: TradegramInterestDialogProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const createInterest = useCreateTradegramInterest();
  const copy = COPY[kind];

  function resetForm() {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setMessage("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Informe seu nome");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("Informe um e-mail ou telefone para contato");
      return;
    }
    createInterest.mutate(
      {
        orgSlug,
        storeId,
        mapObjectId,
        kind,
        spaceCode: spaceCode ?? undefined,
        spaceLabel: spaceLabel ?? undefined,
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(copy.success);
          resetForm();
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
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {(spaceLabel || spaceCode) && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Ponto: </span>
            <span className="font-medium">{spaceLabel ?? "Espaço"}</span>
            {spaceCode && (
              <span className="text-muted-foreground"> · {spaceCode}</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="interest-name">Seu nome *</Label>
            <Input
              id="interest-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome e sobrenome"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interest-company">Empresa / indústria</Label>
            <Input
              id="interest-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Ex.: Nestlé, distribuidora, agência"
              autoComplete="organization"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="interest-email">E-mail</Label>
              <Input
                id="interest-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interest-phone">Telefone / WhatsApp</Label>
              <Input
                id="interest-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(00) 00000-0000"
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interest-message">Mensagem (opcional)</Label>
            <Textarea
              id="interest-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Conte o que você procura neste ponto."
              rows={3}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Seus dados vão só para a loja responsável, dentro da plataforma.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={createInterest.isPending}>
              {createInterest.isPending ? "Enviando…" : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
