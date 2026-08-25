"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import {
  useAccounts,
  usePayEntry,
} from "@/features/financeiro/hooks/use-financeiro";
import { formatCents, reaisToCents } from "@/features/financeiro/lib/money";
import type { FinanceEntry } from "@/features/financeiro/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const NONE = "__none__";

const schema = z.object({
  amount: z.number().positive("Informe um valor maior que zero"),
  paidAt: z.string().min(1, "Informe a data"),
  accountId: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FinanceEntry | null;
}

export function PayEntryDialog({ open, onOpenChange, entry }: Props) {
  const payEntry = usePayEntry();
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.accounts ?? [];

  const remainingReais = entry ? entry.remaining / 100 : 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: remainingReais,
      paidAt: new Date().toISOString().slice(0, 10),
      accountId: NONE,
    },
  });

  useEffect(() => {
    if (!open || !entry) return;
    form.reset({
      amount: entry.remaining / 100,
      paidAt: new Date().toISOString().slice(0, 10),
      accountId: entry.accountId ?? NONE,
    });
  }, [open, entry, form]);

  const onSubmit = (data: FormValues) => {
    if (!entry) return;
    const cents = reaisToCents(data.amount);
    if (cents > entry.remaining) {
      form.setError("amount", {
        message: `Valor maior que o saldo em aberto (${formatCents(entry.remaining)})`,
      });
      return;
    }
    payEntry.mutate(
      {
        id: entry.id,
        amount: cents,
        paidAt: new Date(data.paidAt).toISOString(),
        accountId: data.accountId === NONE ? undefined : data.accountId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      },
    );
  };

  const isLoading = payEntry.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixar lançamento</DialogTitle>
          <DialogDescription>
            {entry
              ? `${entry.description} — saldo em aberto ${formatCents(entry.remaining)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Valor (R$)</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="paidAt"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Data da baixa</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="date"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="accountId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Conta</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={field.name} disabled={isLoading}>
                      <SelectValue placeholder="Sem conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem conta</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
