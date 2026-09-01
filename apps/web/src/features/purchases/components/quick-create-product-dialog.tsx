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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { PriceMetrics } from "@/features/products/components/price-metrics";
import { ProductUnit } from "@/generated/prisma/enums";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useQuickCreateProduct } from "../hooks/use-purchases";
import type { PickedProduct } from "./item-search";

const schema = z.object({
  name: z.string().min(1, "Informe o nome do produto"),
  barcode: z.string(),
  sku: z.string(),
  unit: z.enum(ProductUnit),
  costPrice: z.number().min(0),
  // Obrigatório e sem default: produto nascer com preço zero cria margem
  // negativa que ninguém percebe até a venda.
  salePrice: z.number().positive("Informe o preço de venda"),
});

type FormData = z.infer<typeof schema>;

const UNIDADES: { value: ProductUnit; label: string }[] = [
  { value: ProductUnit.UN, label: "Unidade" },
  { value: ProductUnit.KG, label: "Quilograma" },
  { value: ProductUnit.G, label: "Grama" },
  { value: ProductUnit.L, label: "Litro" },
  { value: ProductUnit.ML, label: "Mililitro" },
  { value: ProductUnit.CX, label: "Caixa" },
  { value: ProductUnit.PC, label: "Peça" },
  { value: ProductUnit.PAR, label: "Par" },
  { value: ProductUnit.DZ, label: "Dúzia" },
  { value: ProductUnit.M, label: "Metro" },
  { value: ProductUnit.M2, label: "Metro quadrado" },
  { value: ProductUnit.M3, label: "Metro cúbico" },
];

/**
 * Cadastro mínimo, sem sair da nota.
 *
 * O estoque NÃO é pedido aqui de propósito: quem põe mercadoria é o
 * processamento da entrada. Semear estoque no cadastro e processar a nota
 * depois contaria a mesma caixa duas vezes.
 */
export function QuickCreateProductDialog({
  barcode,
  supplierId,
  onOpenChange,
  onCreated,
}: {
  /** `null` = fechado. String (mesmo vazia) = aberto, com o código lido. */
  barcode: string | null;
  supplierId: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: PickedProduct) => void;
}) {
  const mutation = useQuickCreateProduct();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      barcode: "",
      sku: "",
      unit: ProductUnit.UN,
      costPrice: 0,
      salePrice: 0,
    },
  });

  const aberto = barcode !== null;

  useEffect(() => {
    if (aberto) {
      form.reset({
        name: "",
        barcode: barcode ?? "",
        sku: "",
        unit: ProductUnit.UN,
        costPrice: 0,
        salePrice: 0,
      });
    }
  }, [aberto, barcode, form]);

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        name: data.name,
        barcode: data.barcode.trim() || null,
        sku: data.sku.trim() || null,
        unit: data.unit,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        supplierId,
      },
      { onSuccess: (result) => onCreated(result.product) },
    );
  };

  const costPrice = Number(form.watch("costPrice")) || 0;
  const salePrice = Number(form.watch("salePrice")) || 0;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar produto</DialogTitle>
          <DialogDescription>
            O estoque entra quando a nota for processada — aqui é só o cadastro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Ex.: Arroz Tipo 1 5kg"
                    disabled={mutation.isPending}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="flex items-start gap-4">
              <Controller
                name="barcode"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field className="flex-1">
                    <FieldLabel htmlFor={field.name}>
                      Código de barras
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      disabled={mutation.isPending}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="sku"
                control={form.control}
                render={({ field }) => (
                  <Field className="flex-1">
                    <FieldLabel htmlFor={field.name}>SKU</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      disabled={mutation.isPending}
                    />
                  </Field>
                )}
              />
            </div>

            <div className="flex items-start gap-4">
              <Controller
                name="unit"
                control={form.control}
                render={({ field }) => (
                  <Field className="flex-1">
                    <FieldLabel htmlFor={field.name}>Unidade</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={mutation.isPending}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES.map((unidade) => (
                          <SelectItem key={unidade.value} value={unidade.value}>
                            {unidade.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                name="costPrice"
                control={form.control}
                render={({ field }) => (
                  <Field className="flex-1">
                    <FieldLabel htmlFor={field.name}>Custo (R$)</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value) || 0)
                      }
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={mutation.isPending}
                    />
                  </Field>
                )}
              />
              <Controller
                name="salePrice"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field className="flex-1">
                    <FieldLabel htmlFor={field.name}>Venda (R$)</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value) || 0)
                      }
                      type="number"
                      step="0.01"
                      min={0}
                      aria-invalid={fieldState.invalid}
                      disabled={mutation.isPending}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <PriceMetrics
              costPrice={costPrice}
              salePrice={salePrice}
              onSalePriceChange={(value) =>
                form.setValue("salePrice", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              Cadastrar e adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
