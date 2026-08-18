"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuerySupplier, useUpdateSupplier } from "../hooks/use-supplier";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCPForCNPJ } from "@/utils/format-cnpj";
import { phoneMask } from "@/utils/format-phone";
import { cepMask } from "@/utils/format-cep";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { getAddressByCep } from "@/utils/get-address-by-cep";
import { Textarea } from "@/components/ui/textarea";
import { LogoUploader } from "@/components/logo-uploader/uploader";
import { SenhaImageField } from "./senha-image-field";

interface EditSupplierProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const editSupplierSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").optional(),
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

export const EditSupplier = ({ id, open, onOpenChange }: EditSupplierProps) => {
  const { supplier } = useQuerySupplier(id);
  const form = useForm<z.infer<typeof editSupplierSchema>>({
    resolver: zodResolver(editSupplierSchema),
    defaultValues: {
      personType: supplier?.personType ?? "JURIDICA",
      name: supplier?.name ?? "",
      tradeName: supplier?.tradeName ?? "",
      document: supplier?.document ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      logo: supplier?.logo ?? "",
      actionCodeImage: supplier?.actionCodeImage ?? "",
      cep: supplier?.zipCode ?? "",
      city: supplier?.city ?? "",
      state: supplier?.state ?? "",
      address: supplier?.address ?? "",
      notes: supplier?.notes ?? "",
    },
  });
  const updateSupplier = useUpdateSupplier();

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

  const onSubmit = (data: z.infer<typeof editSupplierSchema>) => {
    updateSupplier.mutate(
      {
        id,
        name: data.name,
        tradeName: data.tradeName,
        personType: data.personType,
        document: data.document,
        phone: data.phone,
        email: data.email,
        contactPerson: data.contactPerson,
        logo: data.logo,
        actionCodeImage: data.actionCodeImage,
        zipCode: data.cep,
        city: data.city,
        state: data.state,
        address: data.address,
        notes: data.notes,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  useEffect(() => {
    if (open && supplier) {
      form.reset({
        personType: supplier.personType,
        name: supplier.name,
        tradeName: supplier.tradeName ?? "",
        document: supplier.document ?? "",
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        contactPerson: supplier.contactPerson ?? "",
        logo: supplier.logo ?? "",
        actionCodeImage: supplier.actionCodeImage ?? "",
        cep: supplier.zipCode ?? "",
        city: supplier.city ?? "",
        state: supplier.state ?? "",
        address: supplier.address ?? "",
        notes: supplier.notes ?? "",
      });
    }
  }, [open, supplier, form]);

  const formIsUpdated = form.formState.isDirty;
  const isSaving = updateSupplier.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar fornecedor</DialogTitle>
          <DialogDescription>
            Atualize as informações do fornecedor
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
                        disabled={isSaving}
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
                      disabled={isSaving}
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
                      disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                      disabled={isSaving}
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
                      disabled={isSaving}
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
            <Button type="submit" disabled={isSaving || !formIsUpdated}>
              {isSaving && <Spinner />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
