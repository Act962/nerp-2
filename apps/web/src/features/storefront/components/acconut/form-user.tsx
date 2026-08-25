"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonType } from "@/generated/prisma/enums";
import { updateCustomer } from "@/features/storefront/hooks/use-catalog-customer";
import { phoneMask } from "@/utils/format-phone";
import { formatCPForCNPJ } from "@/utils/format-cnpj";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FileIcon } from "lucide-react";
import Link from "next/link";

const schemaForm = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  document: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  personType: z.enum(PersonType),
});

interface Customer {
  name: string;
  createdAt: Date;
  email: string | null;
  notes: string | null;
  address: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  document: string | null;
  addressNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  personType: PersonType;
}

interface FormCustomerProps {
  customer: Customer;
  isFormCustomerLoading: boolean;
  subdomain: string;
}

export function FormCustomer({
  customer,
  isFormCustomerLoading,
  subdomain,
}: FormCustomerProps) {
  const form = useForm<z.infer<typeof schemaForm>>({
    defaultValues: {
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      document: customer.document ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      addressNumber: customer.addressNumber ?? "",
      complement: customer.complement ?? "",
      neighborhood: customer.neighborhood ?? "",
      personType: customer.personType,
    },
    resolver: zodResolver(schemaForm),
  });
  const updateCustomerMutation = updateCustomer();

  const onSubmit = (data: z.infer<typeof schemaForm>) => {
    updateCustomerMutation.mutate({
      subdomain,
      email: customer.email ?? "",
      name: data.name,
      phone: data.phone,
      document: data.document,
      city: data.city,
      state: data.state,
      addressNumber: data.addressNumber,
      complement: data.complement,
      neighborhood: data.neighborhood,
      personType: data.personType,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarFallback>{customer.name}</AvatarFallback>
            <AvatarImage src="https://github.com/elfabrica.png" />
          </Avatar>
          <CardTitle>Minha Conta</CardTitle>
        </div>
      </CardHeader>
      <Separator className="mb-4" />
      <CardContent>
        <div className="flex items-center mb-4">
          <h1 className="text-2xl font-semibold">Minhas Informações</h1>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Nome</FieldLabel>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div>
                      <Input {...field} />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </div>
                  )}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input disabled {...field} />
                  )}
                </Field>
              )}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Controller
              name="phone"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Telefone</FieldLabel>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      placeholder="(00) 00000-0000"
                      value={phoneMask(field.value ?? "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                </Field>
              )}
            />
            <Controller
              name="document"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>CPF/CNPJ</FieldLabel>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={formatCPForCNPJ(field.value ?? "")}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                </Field>
              )}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Controller
              name="state"
              control={form.control}
              render={({ field }) => (
                <Field>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <FieldLabel>Gênero</FieldLabel>
                  )}
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PersonType.FISICA}>Física</SelectItem>
                      <SelectItem value={PersonType.JURIDICA}>
                        Juridica
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              name="city"
              control={form.control}
              render={({ field }) => (
                <Field>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <FieldLabel>Cidade</FieldLabel>
                  )}
                  <Input placeholder="Cidade" {...field} />
                </Field>
              )}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Controller
              name="addressNumber"
              control={form.control}
              render={({ field }) => (
                <Field>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <FieldLabel>Número</FieldLabel>
                  )}
                  <Input placeholder="Número" {...field} />
                </Field>
              )}
            />

            <Controller
              name="neighborhood"
              control={form.control}
              render={({ field }) => (
                <Field>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <FieldLabel>Bairro</FieldLabel>
                  )}
                  <Input placeholder="Bairro" {...field} />
                </Field>
              )}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Controller
              name="complement"
              control={form.control}
              render={({ field }) => (
                <Field>
                  {isFormCustomerLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <FieldLabel>Complemento</FieldLabel>
                  )}
                  <Input placeholder="Complemento" {...field} />
                </Field>
              )}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
export function FormSkeleton() {
  return (
    <div>
      <div className="flex items-center py-4">
        <span className="text-xl font-bold">Olá, </span>
        <Skeleton className="h-5 w-20 rounded-full bg-accent-foreground/10" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <CardTitle>Minha Conta</CardTitle>
          </div>
        </CardHeader>
        <Separator className="mb-4" />
        <CardContent>
          <div className="flex items-center mb-4">
            <h1 className="text-2xl font-semibold">Minhas Informações</h1>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full">
                <FieldLabel>Nome</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="w-full">
                <FieldLabel>Email</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full">
                <FieldLabel>Telefone</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="w-full">
                <FieldLabel>CPF/CNPJ</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full">
                <FieldLabel>Gênero</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="w-full">
                <FieldLabel>Cidade</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full">
                <FieldLabel>Estado</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="w-full">
                <FieldLabel>CEP</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full">
                <FieldLabel>Endereço</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="w-full">
                <FieldLabel>Número</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full">
                <FieldLabel>Bairro</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="w-full">
                <FieldLabel>Complemento</FieldLabel>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function FormEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileIcon />
        </EmptyMedia>
        <EmptyTitle>Você não está autenticado</EmptyTitle>
        <EmptyDescription>
          Faça login para continuar navegando nesta sessão.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button>
            <Link href="sign-in">Entrar</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
