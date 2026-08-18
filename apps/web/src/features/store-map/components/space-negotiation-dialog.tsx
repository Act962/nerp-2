"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBrands } from "@/features/brands/hooks/use-brands";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { useNegotiationTypes } from "@/features/trade-catalog/hooks/use-trade-catalog";
import type { NegotiationStatus } from "@/generated/prisma/enums";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateSpaceNegotiation } from "../hooks/use-space-negotiations";

const NONE = "__none__";

const STATUS_OPTIONS: { value: NegotiationStatus; label: string }[] = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "PROPOSTA", label: "Proposta" },
  { value: "FECHADA", label: "Fechada" },
  { value: "CANCELADA", label: "Cancelada" },
];

interface SpaceNegotiationDialogProps {
  mapObjectId: string;
  spaceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpaceNegotiationDialog({
  mapObjectId,
  spaceLabel,
  open,
  onOpenChange,
}: SpaceNegotiationDialogProps) {
  const { suppliers } = useSupplier();
  const { negotiationTypes } = useNegotiationTypes();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [negotiationTypeId, setNegotiationTypeId] = useState<string | null>(null);
  const [distributor, setDistributor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<NegotiationStatus>("RASCUNHO");
  const [notes, setNotes] = useState("");

  const { brands } = useBrands(supplierId ?? undefined);
  const createNegotiation = useCreateSpaceNegotiation();

  const reset = () => {
    setSupplierId(null);
    setBrandId(null);
    setNegotiationTypeId(null);
    setDistributor("");
    setStartDate("");
    setEndDate("");
    setAmount("");
    setStatus("RASCUNHO");
    setNotes("");
  };

  const handleSubmit = () => {
    createNegotiation.mutate(
      {
        mapObjectId,
        supplierId,
        brandId,
        negotiationTypeId,
        distributor: distributor || null,
        startDate: startDate || null,
        endDate: endDate || null,
        amount: amount ? Number(amount) : null,
        status,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Negociação registrada");
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova negociação · {spaceLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>Indústria</FieldLabel>
            <Select
              value={supplierId ?? NONE}
              onValueChange={(value) => {
                setSupplierId(value === NONE ? null : value);
                setBrandId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a indústria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {supplierId && (
            <Field>
              <FieldLabel>Marca</FieldLabel>
              <Select
                value={brandId ?? NONE}
                onValueChange={(value) =>
                  setBrandId(value === NONE ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field>
            <FieldLabel>Tipo de negociação</FieldLabel>
            <Select
              value={negotiationTypeId ?? NONE}
              onValueChange={(value) =>
                setNegotiationTypeId(value === NONE ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {negotiationTypes.map((negotiationType) => (
                  <SelectItem key={negotiationType.id} value={negotiationType.id}>
                    {negotiationType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="negotiation-distributor">
              Distribuidor / Representante
            </FieldLabel>
            <Input
              id="negotiation-distributor"
              value={distributor}
              placeholder="Ex.: Solar"
              onChange={(event) => setDistributor(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="negotiation-start">Início</FieldLabel>
              <Input
                id="negotiation-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="negotiation-end">Fim</FieldLabel>
              <Input
                id="negotiation-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="negotiation-amount">Valor (R$)</FieldLabel>
              <Input
                id="negotiation-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                placeholder="0,00"
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as NegotiationStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="negotiation-notes">Observações</FieldLabel>
            <Textarea
              id="negotiation-notes"
              value={notes}
              rows={3}
              placeholder="Detalhes da negociação"
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createNegotiation.isPending}
          >
            Salvar negociação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
