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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCreateBook } from "../hooks/use-books";

const NONE = "__none__";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

interface CreateBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBookDialog({
  open,
  onOpenChange,
}: CreateBookDialogProps) {
  const router = useRouter();
  const { suppliers } = useSupplier();
  const createBook = useCreateBook();

  const now = new Date();
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState(NONE);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  useEffect(() => {
    if (!open) return;
    setName("");
    setSupplierId(NONE);
    setMonth(String(new Date().getMonth() + 1));
    setYear(String(new Date().getFullYear()));
  }, [open]);

  const handleSubmit = () => {
    createBook.mutate(
      {
        name,
        supplierId: supplierId === NONE ? undefined : supplierId,
        periodMonth: Number(month),
        periodYear: Number(year),
      },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          router.push(`/books/${result.id}`);
        },
      },
    );
  };

  const isValid = name.trim() && month && year;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo book</DialogTitle>
          <DialogDescription>
            Crie um book fotográfico para enviar à indústria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="book-name">Nome do book</FieldLabel>
            <Input
              id="book-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Ações Nestlé — Julho"
            />
          </Field>

          <Field>
            <FieldLabel>Indústria (opcional)</FieldLabel>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (book geral de ações)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  Nenhuma (book geral de ações)
                </SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex gap-4">
            <Field>
              <FieldLabel>Mês</FieldLabel>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="book-year">Ano</FieldLabel>
              <Input
                id="book-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </Field>
          </div>
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
            disabled={!isValid || createBook.isPending}
          >
            {createBook.isPending && <Spinner />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
