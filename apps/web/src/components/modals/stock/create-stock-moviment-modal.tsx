"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProducts } from "@/features/products/hooks/use-products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MovementType } from "@/generated/prisma/enums";

import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const CreateMovimentSchema = z.object({
  type: z.custom<MovementType>(),
  productId: z.string().min(1, "Selecione um produto"),
  quantity: z.number().min(1, "Informe a quantidade"),
  description: z.string().optional(),
});

// "ENTRADA" | "SAIDA" | "VENDA" | "COMPRA" | "DEVOLUCAO" | "AJUSTE" | "TRANSFERENCIA" | "PERDA"

const Types = [
  {
    name: "Entrada",
    value: MovementType.ENTRADA,
  },
  {
    name: "Saída",
    value: MovementType.SAIDA,
  },
  {
    name: "Venda",
    value: MovementType.VENDA,
  },
  {
    name: "Compra",
    value: MovementType.COMPRA,
  },
  {
    name: "Devolução",
    value: MovementType.DEVOLUCAO,
  },
  {
    name: "Ajuste",
    value: MovementType.AJUSTE,
  },
  {
    name: "Transferência",
    value: MovementType.TRANSFERENCIA,
  },
  {
    name: "Perda",
    value: MovementType.PERDA,
  },
];

type CreateMovimentSchemaType = z.infer<typeof CreateMovimentSchema>;

type CreateStockMovimentModalProps = {
  product?: { id: string; name: string };
  trigger?: React.ReactNode;
  onSuccess?: () => void;
};

export function CreateStockMovimentModal({
  product,
  trigger,
  onSuccess,
}: CreateStockMovimentModalProps = {}) {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [openProduct, setOpenProduct] = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedProductName, setSelectedProductName] = useState(
    product?.name ?? "",
  );
  const debouncedSearch = useDebouncedValue(searchProduct, 400);
  const form = useForm<CreateMovimentSchemaType>({
    resolver: zodResolver(CreateMovimentSchema),
    defaultValues: {
      type: MovementType.ENTRADA,
      productId: product?.id ?? "",
      description: "",
    },
  });

  const { data, isLoading } = useProducts({
    name: debouncedSearch,
    limit: 20,
  });

  const onSucessFinish = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.stocks.list.queryKey({
        input: {
          offset: 1,
          limit: 100,
        },
      }),
    });
    form.reset({
      type: MovementType.ENTRADA,
      productId: product?.id ?? "",
      description: "",
    });
    setSearchProduct("");
    setSelectedProductName(product?.name ?? "");
    setOpenModal(false);
    toast.success("Movimentação registrada com sucesso");
    onSuccess?.();
  };

  const onErrorFinish = (message: string) => {
    return toast.error(message);
  };

  const onRegisterEntry = useMutation(
    orpc.stocks.create.entry.mutationOptions({
      onSuccess: () => onSucessFinish(),
      onError: (error) => onErrorFinish(error.message),
    }),
  );

  const onRegisterOutput = useMutation(
    orpc.stocks.create.output.mutationOptions({
      onSuccess: () => onSucessFinish(),
      onError: (error) => onErrorFinish(error.message),
    }),
  );

  const onSubmit = (data: CreateMovimentSchemaType) => {
    switch (data.type) {
      case MovementType.ENTRADA:
        onRegisterEntry.mutate(data);
        break;
      case MovementType.SAIDA:
        onRegisterOutput.mutate(data);
        break;
      case MovementType.PERDA:
        onRegisterOutput.mutate(data);
        break;
      default:
        break;
    }
  };

  const isRegisterLoading =
    onRegisterEntry.isPending || onRegisterOutput.isPending;

  useEffect(() => {
    if (!openModal) {
      form.reset({
        type: MovementType.ENTRADA,
        productId: product?.id ?? "",
        description: "",
      });
      setSearchProduct("");
      setSelectedProductName(product?.name ?? "");
    }
  }, [openModal, form.reset, product?.id, product?.name]);

  return (
    <Dialog open={openModal} onOpenChange={setOpenModal}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> Nova Movimentação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
          <DialogDescription>
            Crie uma nova movimentação de estoque
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup>
            <Controller
              name="type"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Tipo de Movimentação
                  </FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isRegisterLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {Types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              name="productId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Produto</FieldLabel>
                  <Popover open={openProduct} onOpenChange={setOpenProduct}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        disabled={isRegisterLoading || !!product}
                      >
                        {field.value ? (
                          selectedProductName
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Selecione um produto
                          </span>
                        )}
                        <ChevronsUpDown className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0  w-[310px] sm:w-[440px]"
                      align="start"
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar produto..."
                          value={searchProduct}
                          onValueChange={setSearchProduct}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoading ? "Carregando..." : "Nenhum produto"}
                          </CommandEmpty>
                          <CommandGroup>
                            {!isLoading &&
                              data.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name}-${product.id}`}
                                  className="cursor-pointer"
                                  onSelect={() => {
                                    field.onChange(product.id);
                                    setSelectedProductName(product.name);
                                    setOpenProduct(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "size-4",
                                      field.value === product.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {product.name}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {fieldState.error && (
                    <FieldError> {fieldState.error.message} </FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="quantity"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Quantidade</FieldLabel>
                  <Input
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    id={field.name}
                    placeholder="0"
                    type="number"
                    disabled={isRegisterLoading}
                  />
                  {fieldState.error && (
                    <FieldError> {fieldState.error.message} </FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    placeholder="Adicione uma observação sobre esta movimentação"
                    className="min-h-[100px]"
                    disabled={isRegisterLoading}
                  />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <DialogClose asChild disabled={isRegisterLoading}>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isRegisterLoading}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
