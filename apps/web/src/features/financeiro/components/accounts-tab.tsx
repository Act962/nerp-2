"use client";

import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "@/features/financeiro/hooks/use-financeiro";
import { ACCOUNT_TYPE_LABEL } from "@/features/financeiro/lib/labels";
import { formatCents, reaisToCents } from "@/features/financeiro/lib/money";
import type {
  AccountType,
  FinanceAccount,
} from "@/features/financeiro/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CASH", "DIGITAL"];

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  bankName: z.string(),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]),
  balance: z.number(),
  color: z.string(),
  isDefault: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: FinanceAccount | null;
}) {
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const isEdit = Boolean(account);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      bankName: "",
      type: "CHECKING",
      balance: 0,
      color: "#6366f1",
      isDefault: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: account?.name ?? "",
      bankName: account?.bankName ?? "",
      type: account?.type ?? "CHECKING",
      balance: account ? account.balance / 100 : 0,
      color: account?.color ?? "#6366f1",
      isDefault: account?.isDefault ?? false,
    });
  }, [open, account, form]);

  const isLoading = createAccount.isPending || updateAccount.isPending;

  const onSubmit = (data: FormValues) => {
    const onSuccess = () => {
      onOpenChange(false);
      form.reset();
    };
    if (account) {
      updateAccount.mutate(
        {
          id: account.id,
          name: data.name,
          bankName: data.bankName || null,
          type: data.type,
          color: data.color || null,
          isDefault: data.isDefault,
        },
        { onSuccess },
      );
    } else {
      createAccount.mutate(
        {
          name: data.name,
          bankName: data.bankName || undefined,
          type: data.type,
          balance: reaisToCents(data.balance),
          color: data.color || undefined,
          isDefault: data.isDefault,
        },
        { onSuccess },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Contas bancárias, caixa e carteiras digitais.
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
                    placeholder="Ex.: Caixa loja"
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
                name="bankName"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Banco</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="Ex.: Nubank"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={field.name} disabled={isLoading}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACCOUNT_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>
            <div className="flex items-start gap-4">
              {!isEdit && (
                <Controller
                  name="balance"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Saldo inicial (R$)
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        step="0.01"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        disabled={isLoading}
                      />
                    </Field>
                  )}
                />
              )}
              <Controller
                name="color"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Cor</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="color"
                      className="h-9 w-16 p-1"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
            </div>
            <Controller
              name="isDefault"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch
                    id={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                  <FieldLabel htmlFor={field.name}>Conta padrão</FieldLabel>
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
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountsTab() {
  const { data, isPending } = useAccounts(true);
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);

  const accounts = data?.accounts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Nova conta
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table stacked>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhuma conta cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell data-label="Nome" className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{
                          backgroundColor: account.color ?? "var(--muted)",
                        }}
                      />
                      {account.name}
                      {account.isDefault && (
                        <Badge variant="secondary">Padrão</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell
                    data-label="Banco"
                    className="text-muted-foreground"
                  >
                    {account.bankName ?? "—"}
                  </TableCell>
                  <TableCell data-label="Tipo">
                    {ACCOUNT_TYPE_LABEL[account.type]}
                  </TableCell>
                  <TableCell
                    data-label="Saldo"
                    className="text-right tabular-nums"
                  >
                    {formatCents(account.balance)}
                  </TableCell>
                  <TableCell data-label="Status">
                    {account.isActive ? (
                      <Badge variant="secondary">Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(account);
                          setOpen(true);
                        }}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAccount.mutate({ id: account.id })}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AccountDialog open={open} onOpenChange={setOpen} account={editing} />
    </div>
  );
}
