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
import { useQueryCustomer, useUpdateCustomer } from "../hooks/use-customer";
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
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface ViewCustomerProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sentinel usado no Select — Radix não aceita `value=""`.
const NO_PRICE_LIST = "__default__";

const editCustomerSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").optional(),
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

export const EditCustomer = ({ id, open, onOpenChange }: ViewCustomerProps) => {
  const { customer, isLoading } = useQueryCustomer(id);
  const { data: priceLists = [] } = useQuery(orpc.precos.list.queryOptions({ input: {} }));
  const form = useForm<z.infer<typeof editCustomerSchema>>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      type: customer?.personType,
      name: customer?.name,
      document: customer?.document ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      city: customer?.city ?? "",
      state: customer?.state ?? "",
      cep: customer?.zipCode ?? "",
      address: customer?.address ?? "",
      description: customer?.notes ?? "",
      priceListId:
        (customer as { priceListId?: string | null } | undefined)?.priceListId ??
        NO_PRICE_LIST,
    },
  });
  const updateCustomer = useUpdateCustomer();

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

  const onSubmit = (data: z.infer<typeof editCustomerSchema>) => {
    updateCustomer.mutate(
      {
        id,
        name: data.name,
        document: data.document,
        phone: data.phone,
        email: data.email,
        personType: data.type,
        city: data.city,
        state: data.state,
        zipCode: data.cep,
        address: data.address,
        notes: data.description,
        // "__default__" = usa a tabela default da org (guardamos como null).
        priceListId:
          data.priceListId && data.priceListId !== NO_PRICE_LIST
            ? data.priceListId
            : null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  useEffect(() => {
    if (open && customer) {
      form.reset({
        type: customer.personType,
        name: customer.name,
        document: customer.document ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        cep: customer.zipCode ?? "",
        address: customer.address ?? "",
        description: customer.notes ?? "",
        priceListId:
          (customer as { priceListId?: string | null }).priceListId ??
          NO_PRICE_LIST,
      });
    }
  }, [open, customer, form]);

  const formIsUpdated = form.formState.isDirty;
  const isEditCustomerLoading = updateCustomer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Informações completas e histórico de compras
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
                      disabled={isEditCustomerLoading}
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
                    disabled={isEditCustomerLoading}
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
                    disabled={isEditCustomerLoading}
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
                      disabled={isEditCustomerLoading}
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
                      disabled={isEditCustomerLoading}
                      onChange={(e) => {
                        field.onChange(phoneMask(e.target.value));
                      }}
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
                      disabled={isEditCustomerLoading}
                      onChange={(e) => {
                        const maskedValue = cepMask(e.target.value);
                        field.onChange(maskedValue);

                        handleCepChange(maskedValue);
                      }}
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
                      disabled={isEditCustomerLoading}
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
                      disabled={isEditCustomerLoading}
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
                    disabled={isEditCustomerLoading}
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
                      disabled={isEditCustomerLoading}
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
                    disabled={isEditCustomerLoading}
                  />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isEditCustomerLoading || !formIsUpdated}
            >
              {isEditCustomerLoading && <Spinner />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
