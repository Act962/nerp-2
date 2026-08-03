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
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateSupplier } from "../hooks/use-supplier";
import { phoneMask } from "@/utils/format-phone";
import { formatCPForCNPJ } from "@/utils/format-cnpj";
import { cepMask } from "@/utils/format-cep";
import { getAddressByCep } from "@/utils/get-address-by-cep";
import { Spinner } from "@/components/ui/spinner";
import { LogoUploader } from "@/components/logo-uploader/uploader";
import { SenhaImageField } from "./senha-image-field";

const createSupplierSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  tradeName: z.string().optional(),
  personType: z.enum(["FISICA", "JURIDICA"]),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  contactPerson: z.string().optional(),
  logo: z.string().optional(),
  actionCodeImage: z.string().optional(),
  cep: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const AddSupplierModal = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof createSupplierSchema>>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      personType: "JURIDICA",
      name: "",
      tradeName: "",
      document: "",
      phone: "",
      email: "",
      contactPerson: "",
      logo: "",
      actionCodeImage: "",
      cep: "",
      city: "",
      state: "",
      address: "",
      notes: "",
    },
  });
  const createSupplier = useCreateSupplier();

  const onSubmit = async (data: z.infer<typeof createSupplierSchema>) => {
    createSupplier.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
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
          }`,
        );
      }
    }
  };

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form.reset]);

  const isLoading = createSupplier.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Fornecedor</DialogTitle>
          <DialogDescription>
            Preencha as informações para cadastrar um novo fornecedor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="overflow-y-auto max-h-[60vh] pr-1">
            <FieldGroup>
              <Controller
                name="logo"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Logo</FieldLabel>
                    <LogoUploader
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </Field>
                )}
              />
              <Controller
                name="actionCodeImage"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Imagem da senha do mês</FieldLabel>
                    <SenhaImageField
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </Field>
                )}
              />
              <Controller
                name="personType"
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
                        disabled={isLoading}
                      >
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JURIDICA">
                          Pessoa Jurídica
                        </SelectItem>
                        <SelectItem value="FISICA">Pessoa Física</SelectItem>
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
                    <FieldLabel htmlFor={field.name}>
                      Razão Social / Nome
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: Empresa Distribuidora Ltda"
                      disabled={isLoading}
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="tradeName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Nome Fantasia</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex.: Distribuidora ABC"
                      disabled={isLoading}
                    />
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
                        placeholder="Ex.: 00.000.000/0001-00"
                        onChange={(e) => {
                          field.onChange(formatCPForCNPJ(e.target.value));
                        }}
                        disabled={isLoading}
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
                        disabled={isLoading}
                      />
                    </Field>
                  )}
                />
              </div>
              <div className="flex items-center gap-4">
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
                        placeholder="Ex.: contato@empresa.com"
                        disabled={isLoading}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="contactPerson"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Pessoa de Contato
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        placeholder="Ex.: João Silva"
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
              <Controller
                name="notes"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Observação</FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Informações adicionais sobre o fornecedor"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
            </FieldGroup>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
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
};
