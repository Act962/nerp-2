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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
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
  const createBook = useCreateBook();

  // Indústria via combobox com busca no servidor (a lista pode ser grande; o
  // Select truncava em 10 e escondia indústrias como a Pepsico).
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierLabel, setSupplierLabel] = useState("");
  const { suppliers, isLoading: suppliersLoading } = useSupplier({
    search: supplierSearch || undefined,
    pageSize: 100,
  });

  const now = new Date();
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState(NONE);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  useEffect(() => {
    if (!open) return;
    setName("");
    setSupplierId(NONE);
    setSupplierLabel("");
    setSupplierSearch("");
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
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  // biome-ignore lint/a11y/useSemanticElements: combobox trigger
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-full justify-between font-normal"
                >
                  <span
                    className={cn(
                      supplierId === NONE && "text-muted-foreground",
                    )}
                  >
                    {supplierId === NONE
                      ? "Nenhuma (book geral de ações)"
                      : supplierLabel}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar indústria..."
                    value={supplierSearch}
                    onValueChange={setSupplierSearch}
                  />
                  <CommandList>
                    <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                      {suppliersLoading
                        ? "Buscando..."
                        : "Nenhuma indústria encontrada."}
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setSupplierId(NONE);
                          setSupplierLabel("");
                          setSupplierOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            supplierId === NONE ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Nenhuma (book geral de ações)
                      </CommandItem>
                      {suppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.id}
                          onSelect={() => {
                            setSupplierId(supplier.id);
                            setSupplierLabel(supplier.name);
                            setSupplierOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              supplierId === supplier.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {supplier.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
