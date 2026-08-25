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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAbrirCaixa, useCashRegisters } from "../hooks/use-caixa";
import { ManageRegistersDialog } from "./manage-registers-dialog";

const schema = z.object({
  registerId: z.string().min(1, "Escolha o caixa"),
  openingBalance: z.number().min(0, "Informe o valor de abertura"),
  openingNotes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function OpenCaixaDialog() {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const abrir = useAbrirCaixa();
  const { registers, isLoading } = useCashRegisters();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { registerId: "", openingBalance: 0, openingNotes: "" },
  });

  const onSubmit = (values: FormValues) => {
    abrir.mutate(
      {
        registerId: values.registerId,
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

  const hasRegisters = registers.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Abrir caixa</Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
            <DialogDescription>
              Escolha o caixa e informe o valor em dinheiro que inicia a gaveta
              (fundo de troco).
            </DialogDescription>
          </DialogHeader>
          {!isLoading && !hasRegisters ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Nenhum caixa cadastrado.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
              >
                Gerenciar caixas
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="registerId">Caixa</FieldLabel>
                  <Controller
                    control={control}
                    name="registerId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="registerId">
                          <SelectValue placeholder="Selecione o caixa" />
                        </SelectTrigger>
                        <SelectContent>
                          {registers.map((register) => (
                            <SelectItem key={register.id} value={register.id}>
                              {register.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.registerId && (
                    <FieldError>{errors.registerId.message}</FieldError>
                  )}
                </Field>
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
                      <Input
                        id="openingNotes"
                        placeholder="Opcional"
                        {...field}
                      />
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
          )}
        </DialogContent>
      </Dialog>
      <ManageRegistersDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
}
