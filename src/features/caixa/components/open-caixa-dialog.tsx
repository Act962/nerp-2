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
import { useAbrirCaixa } from "../hooks/use-caixa";

const schema = z.object({
  openingBalance: z.number().min(0, "Informe o valor de abertura"),
  openingNotes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function OpenCaixaDialog() {
  const [open, setOpen] = useState(false);
  const abrir = useAbrirCaixa();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { openingBalance: 0, openingNotes: "" },
  });

  const onSubmit = (values: FormValues) => {
    abrir.mutate(
      {
        openingBalance: values.openingBalance,
        openingNotes: values.openingNotes || undefined,
      },
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
        <Button>Abrir caixa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>
            Informe o valor em dinheiro que inicia a gaveta (fundo de troco).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="openingBalance">
                Valor de abertura
              </FieldLabel>
              <Controller
                control={control}
                name="openingBalance"
                render={({ field }) => (
                  <Input
                    id="openingBalance"
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
              {errors.openingBalance && (
                <FieldError>{errors.openingBalance.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="openingNotes">Observações</FieldLabel>
              <Controller
                control={control}
                name="openingNotes"
                render={({ field }) => (
                  <Input id="openingNotes" placeholder="Opcional" {...field} />
                )}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={abrir.isPending}>
              {abrir.isPending ? "Abrindo…" : "Abrir caixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
