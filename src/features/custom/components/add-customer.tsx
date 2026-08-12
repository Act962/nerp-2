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
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateCustomer } from "../hooks/use-customer";
import { phoneMask } from "@/utils/format-phone";
import { formatCPForCNPJ } from "@/utils/format-cnpj";
import { cepMask } from "@/utils/format-cep";
import { getAddressByCep } from "@/utils/get-address-by-cep";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

// Radix não aceita value="", então precisamos de um sentinel para "sem tabela".
const NO_PRICE_LIST = "__default__";

const createCustomerSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.email("Email inválido").or(z.literal("")).optional(),
  type: z.enum(["FISICA", "JURIDICA"]),
  city: z.string().optional(),
  state: z.string().optional(),
  cep: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  priceListId: z.string().optional(),
});

export const AddCustomerModal = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const { data: priceLists = [] } = useQuery(orpc.precos.list.queryOptions({ input: {} }));
  const form = useForm<z.infer<typeof createCustomerSchema>>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      type: "FISICA",
      name: "",
      document: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      cep: "",
      address: "",
      description: "",
      priceListId: NO_PRICE_LIST,
    },
  });
  const createCustomer = useCreateCustomer();

  const onSubmit = async (data: z.infer<typeof createCustomerSchema>) => {
    createCustomer.mutate(
      {
        ...data,
        priceListId:
          data.priceListId && data.priceListId !== NO_PRICE_LIST
            ? data.priceListId
            : null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
        },
      },
    );
  };

  const handleCepChange = async (value: string) => {
    const cleanCep = value.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      const addressData = await getAddressByCep(cleanCep);
      if (addressData) {
        form.setValue("city", addressData.localidade);
        form.setValue("state", addressData.uf);
        form.setValue(
          "address",
          `${addressData.logradouro}${
            addressData.bairro ? `, ${addressData.bairro}` : ""
          }`
        );
      }
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open]);

  const isCreateCustomerLoading = createCustomer.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
          <DialogDescription>
            Preencha as informações para cadastrar um novo cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="type"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      disabled={isCreateCustomerLoading}
                    >
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FISICA">Física</SelectItem>
                      <SelectItem value="JURIDICA">Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
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
                    disabled={isCreateCustomerLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Ex.: joao.silva@email.com"
                    disabled={isCreateCustomerLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="flex items-center gap-4">
              <Controller
                name="document"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>CPF/CNPJ</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: 000.000.000-00"
                      onChange={(e) => {
                        field.onChange(formatCPForCNPJ(e.target.value));
                      }}
                      disabled={isCreateCustomerLoading}
                    />
                  </Field>
                )}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Telefone</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="(00) 00000-0000"
                      onChange={(e) => {
                        field.onChange(phoneMask(e.target.value));
                      }}
                      disabled={isCreateCustomerLoading}
                    />
                  </Field>
                )}
              />
            </div>
            <div className="flex items-center gap-4">
              <Controller
                name="cep"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>CEP</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: 00000-000"
                      onChange={(e) => {
                        const maskedValue = cepMask(e.target.value);
                        field.onChange(maskedValue);

                        handleCepChange(maskedValue);
                      }}
                      disabled={isCreateCustomerLoading}
                    />
                  </Field>
                )}
              />
              <Controller
                name="city"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Cidade</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: São Paulo"
                      disabled={isCreateCustomerLoading}
                    />
                  </Field>
                )}
              />
              <Controller
                name="state"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Estado</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: SP"
                      disabled={isCreateCustomerLoading}
                    />
                  </Field>
                )}
              />
            </div>
            <Controller
              name="address"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Endereço</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Ex.: Rua das Flores, 123"
                    disabled={isCreateCustomerLoading}
                  />
                </Field>
              )}
            />

            <Controller
              name="priceListId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    Tabela de preço
                  </FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value ?? NO_PRICE_LIST}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id={field.name}
                      disabled={isCreateCustomerLoading}
                    >
                      <SelectValue placeholder="Padrão (Varejo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PRICE_LIST}>
                        Padrão da organização
                      </SelectItem>
                      {priceLists
                        .filter((pl) => pl.isActive)
                        .map((pl) => (
                          <SelectItem key={pl.id} value={pl.id}>
                            {pl.name}
                            {pl.isDefault ? " (padrão)" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Observação</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Informações adicionais sobre o cliente"
                    disabled={isCreateCustomerLoading}
                  />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isCreateCustomerLoading}>
              {isCreateCustomerLoading && <Spinner />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
