"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useSangria, useSuprimento } from "../hooks/use-caixa";

const schema = z.object({
  amount: z.number().positive("Informe um valor maior que zero"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Diálogo compartilhado de sangria (retirada) e suprimento (entrada).
export function CashMovementDialog({
  kind,
}: {
  kind: "SANGRIA" | "SUPRIMENTO";
}) {
  const [open, setOpen] = useState(false);
  const sangria = useSangria();
  const suprimento = useSuprimento();
  const mutation = kind === "SANGRIA" ? sangria : suprimento;
  const label = kind === "SANGRIA" ? "Sangria" : "Suprimento";

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, description: "" },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(
      { amount: values.amount, description: values.description || undefined },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {kind === "SANGRIA"
              ? "Retirada de dinheiro da gaveta."
              : "Entrada de dinheiro na gaveta (troco/reforço)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="amount">Valor</FieldLabel>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? 0
                          : Number(event.target.value),
                      )
                    }
                  />
                )}
              />
              {errors.amount && (
                <FieldError>{errors.amount.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Motivo</FieldLabel>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <Input id="description" placeholder="Opcional" {...field} />
                )}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Registrando…"
                : `Registrar ${label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
