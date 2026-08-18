import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldLabel } from "@/components/ui/field";

import {
  formatCurrencyInput,
  parseCurrencyPenny,
} from "@/utils/currency-formatter";
import { PersonType } from "@/schemas/customer";
import { PersonTypeSelect } from "./person-type-select";

const formFilterSchema = z
  .object({
    personType: z.string().optional(),
    minPurchase: z.string().optional(),
    maxPurchase: z.string().optional(),
  })
  .refine((data) => {
    if (data.minPurchase && data.maxPurchase) {
      return data.minPurchase < data.maxPurchase;
    }
    return true;
  }, "O valor minimo deve ser menor que o valor maximo");

export function FilterClients() {
  const [personType, setPersonType] = useQueryState("person_type");
  const [minPurchase, setMinPurchase] = useQueryState("min_purchase");
  const [maxPurchase, setMaxPurchase] = useQueryState("max_purchase");

  const [modalOpen, setModalIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formFilterSchema>>({
    resolver: zodResolver(formFilterSchema),
    defaultValues: {
      personType: personType ?? undefined,
      minPurchase: minPurchase ?? undefined,
      maxPurchase: maxPurchase ?? undefined,
    },
  });

  const handleApplyFilters = () => {
    // Aplica outros filtros
    setPersonType(form.getValues("personType") || null);
    setMinPurchase(parseCurrencyPenny(form.getValues("minPurchase")) || null);
    setMaxPurchase(parseCurrencyPenny(form.getValues("maxPurchase")) || null);

    setModalIsOpen(false);
  };

  const handleClearFilters = () => {
    form.reset({
      personType: undefined,
      minPurchase: undefined,
      maxPurchase: undefined,
    });
    setPersonType(null);
    setMinPurchase(null);
    setMaxPurchase(null);

    setModalIsOpen(false);
  };

  return (
    <Sheet open={modalOpen} onOpenChange={setModalIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full px-4">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Filtre seus clientes aqui</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          <Controller
            name="personType"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Tipo de Pessoa</FieldLabel>
                <PersonTypeSelect
                  value={PersonType[field.value as PersonType]}
                  onChange={field.onChange}
                />
              </Field>
            )}
          />
        </div>

        <div className="flex flex-row gap-2">
          <div className="flex flex-col gap-2">
            <Controller
              name="minPurchase"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="minPurchase">Valor mínimo Total</Label>
                  <InputGroup>
                    <InputGroupInput
                      id="minPurchase"
                      min={0}
                      value={formatCurrencyInput(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0,00"
                      className="w-full"
                    />
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Controller
              name="maxPurchase"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="maxPurchase">Valor máximo Total</Label>
                  <InputGroup>
                    <InputGroupInput
                      id="maxPurchase"
                      min={0}
                      value={formatCurrencyInput(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0,00"
                      className="w-full"
                    />
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />
          </div>
        </div>

        <SheetFooter>
          <Button type="submit" onClick={handleApplyFilters}>
            Aplicar
          </Button>
          <SheetClose asChild>
            <Button onClick={handleClearFilters} variant="outline">
              Limpar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
