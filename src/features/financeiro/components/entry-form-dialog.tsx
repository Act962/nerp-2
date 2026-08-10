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
import { Textarea } from "@/components/ui/textarea";
import {
  useAccounts,
  useCategories,
  useContacts,
  useCostCenters,
  useCreateEntry,
  useUpdateEntry,
} from "@/features/financeiro/hooks/use-financeiro";
import { ENTRY_TYPE_LABEL } from "@/features/financeiro/lib/labels";
import { reaisToCents } from "@/features/financeiro/lib/money";
import type { EntryType, FinanceEntry } from "@/features/financeiro/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const NONE = "__none__";

const schema = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string().min(1, "Informe a descrição"),
  amount: z.number().positive("Informe um valor maior que zero"),
  dueDate: z.string().min(1, "Informe o vencimento"),
  installments: z.number().int().min(1).max(360),
  categoryId: z.string(),
  contactId: z.string(),
  accountId: z.string(),
  costCenterId: z.string(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

function isoToDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinanceEntry | null;
  defaultType?: EntryType;
}

export function EntryFormDialog({
  open,
  onOpenChange,
  entry,
  defaultType = "RECEIVABLE",
}: Props) {
  const isEdit = Boolean(entry);
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  const { data: categoriesData } = useCategories();
  const { data: contactsData } = useContacts();
  const { data: accountsData } = useAccounts();
  const { data: costCentersData } = useCostCenters();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: defaultType,
      description: "",
      amount: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      installments: 1,
      categoryId: NONE,
      contactId: NONE,
      accountId: NONE,
      costCenterId: NONE,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      form.reset({
        type: entry.type,
        description: entry.description,
        amount: entry.amount / 100,
        dueDate: isoToDateInput(entry.dueDate),
        installments: 1,
        categoryId: entry.categoryId ?? NONE,
        contactId: entry.contactId ?? NONE,
        accountId: entry.accountId ?? NONE,
        costCenterId: entry.costCenterId ?? NONE,
        notes: entry.notes ?? "",
      });
    } else {
      form.reset({
        type: defaultType,
        description: "",
        amount: 0,
        dueDate: new Date().toISOString().slice(0, 10),
        installments: 1,
        categoryId: NONE,
        contactId: NONE,
        accountId: NONE,
        costCenterId: NONE,
        notes: "",
      });
    }
  }, [open, entry, defaultType, form]);

  const isLoading = createEntry.isPending || updateEntry.isPending;

  const onSubmit = (data: FormValues) => {
    const opt = (v: string) => (v === NONE ? undefined : v);
    const onSuccess = () => {
      onOpenChange(false);
      form.reset();
    };

    if (entry) {
      updateEntry.mutate(
        {
          id: entry.id,
          description: data.description,
          amount: reaisToCents(data.amount),
          dueDate: new Date(data.dueDate).toISOString(),
          categoryId: opt(data.categoryId) ?? null,
          contactId: opt(data.contactId) ?? null,
          accountId: opt(data.accountId) ?? null,
          costCenterId: opt(data.costCenterId) ?? null,
          notes: data.notes || null,
        },
        { onSuccess },
      );
    } else {
      createEntry.mutate(
        {
          type: data.type,
          description: data.description,
          amount: reaisToCents(data.amount),
          dueDate: new Date(data.dueDate).toISOString(),
          installments: data.installments,
          categoryId: opt(data.categoryId),
          contactId: opt(data.contactId),
          accountId: opt(data.accountId),
          costCenterId: opt(data.costCenterId),
          notes: data.notes || undefined,
        },
        { onSuccess },
      );
    }
  };

  const categories = categoriesData?.categories ?? [];
  const contacts = contactsData?.contacts ?? [];
  const accounts = accountsData?.accounts ?? [];
  const costCenters = costCentersData?.costCenters ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do lançamento."
              : "Cadastre uma nova conta a pagar ou a receber."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FieldGroup>
              {!isEdit && (
                <Controller
                  name="type"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id={field.name} disabled={isLoading}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RECEIVABLE">
                            {ENTRY_TYPE_LABEL.RECEIVABLE}
                          </SelectItem>
                          <SelectItem value="PAYABLE">
                            {ENTRY_TYPE_LABEL.PAYABLE}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              )}

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: Venda nota 1234"
                      disabled={isLoading}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <div className="flex items-start gap-4">
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
                        placeholder="0,00"
                        disabled={isLoading}
                      />
                      {fieldState.error && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="dueDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Vencimento</FieldLabel>
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
                {!isEdit && (
                  <Controller
                    name="installments"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Parcelas</FieldLabel>
                        <Input
                          id={field.name}
                          type="number"
                          min="1"
                          max="360"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          aria-invalid={fieldState.invalid}
                          disabled={isLoading}
                        />
                      </Field>
                    )}
                  />
                )}
              </div>

              <div className="flex items-start gap-4">
                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Categoria</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id={field.name} disabled={isLoading}>
                          <SelectValue placeholder="Sem categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem categoria</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Controller
                  name="contactId"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Contato</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id={field.name} disabled={isLoading}>
                          <SelectValue placeholder="Sem contato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem contato</SelectItem>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <div className="flex items-start gap-4">
                <Controller
                  name="accountId"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Conta</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
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
                <Controller
                  name="costCenterId"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Centro de custo
                      </FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id={field.name} disabled={isLoading}>
                          <SelectValue placeholder="Nenhum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Nenhum</SelectItem>
                          {costCenters.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="notes"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Observação</FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      placeholder="Informações adicionais"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
            </FieldGroup>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
