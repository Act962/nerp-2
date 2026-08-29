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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from "@/features/financeiro/hooks/use-financeiro";
import { CONTACT_TYPE_LABEL } from "@/features/financeiro/lib/labels";
import { formatCents, reaisToCents } from "@/features/financeiro/lib/money";
import type {
  ContactType,
  FinanceContact,
} from "@/features/financeiro/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const TYPES: ContactType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  document: z.string(),
  email: z.string(),
  phone: z.string(),
  contactType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  creditLimit: z.number().min(0),
});

type FormValues = z.infer<typeof schema>;

function ContactDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: FinanceContact | null;
}) {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const isEdit = Boolean(contact);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      document: "",
      email: "",
      phone: "",
      contactType: "BOTH",
      creditLimit: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: contact?.name ?? "",
      document: contact?.document ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      contactType: (contact?.contactType as ContactType) ?? "BOTH",
      creditLimit: contact ? contact.creditLimit / 100 : 0,
    });
  }, [open, contact, form]);

  const isLoading = createContact.isPending || updateContact.isPending;

  const onSubmit = (data: FormValues) => {
    const onSuccess = () => {
      onOpenChange(false);
      form.reset();
    };
    if (contact) {
      updateContact.mutate(
        {
          id: contact.id,
          name: data.name,
          document: data.document || null,
          email: data.email || null,
          phone: data.phone || null,
          contactType: data.contactType,
          creditLimit: reaisToCents(data.creditLimit),
        },
        { onSuccess },
      );
    } else {
      createContact.mutate(
        {
          name: data.name,
          document: data.document || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          contactType: data.contactType,
          creditLimit: reaisToCents(data.creditLimit),
        },
        { onSuccess },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar contato" : "Novo contato"}
          </DialogTitle>
          <DialogDescription>
            Clientes e fornecedores vinculados aos lançamentos.
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
                    placeholder="Ex.: João Silva"
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
                name="document"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Documento (CPF/CNPJ)
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="000.000.000-00"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Telefone</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="(00) 00000-0000"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
            </div>
            <Controller
              name="email"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="contato@empresa.com"
                    disabled={isLoading}
                  />
                </Field>
              )}
            />
            <div className="flex items-start gap-4">
              <Controller
                name="contactType"
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
                            {CONTACT_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                name="creditLimit"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Limite de crédito (R$)
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step="0.01"
                      min="0"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
            </div>
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

export function ContactsTab() {
  const { data, isPending } = useContacts();
  const deleteContact = useDeleteContact();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceContact | null>(null);

  const contacts = data?.contacts ?? [];

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
          Novo contato
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table stacked>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Limite</TableHead>
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
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum contato cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell data-label="Nome" className="font-medium">
                    {contact.name}
                  </TableCell>
                  <TableCell
                    data-label="Documento"
                    className="text-muted-foreground"
                  >
                    {contact.document ?? "—"}
                  </TableCell>
                  <TableCell
                    data-label="Contato"
                    className="text-muted-foreground"
                  >
                    {contact.email ?? contact.phone ?? "—"}
                  </TableCell>
                  <TableCell data-label="Tipo">
                    <Badge variant="secondary">
                      {CONTACT_TYPE_LABEL[contact.contactType as ContactType] ??
                        contact.contactType}
                    </Badge>
                  </TableCell>
                  <TableCell
                    data-label="Limite"
                    className="text-right tabular-nums"
                  >
                    {formatCents(contact.creditLimit)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(contact);
                          setOpen(true);
                        }}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteContact.mutate({ id: contact.id })}
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
      <ContactDialog open={open} onOpenChange={setOpen} contact={editing} />
    </div>
  );
}
