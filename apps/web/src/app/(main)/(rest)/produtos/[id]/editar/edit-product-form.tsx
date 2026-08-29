"use client";

import { Uploader } from "@/components/file-uploader/uploader";
import { PageHeader } from "@/components/page-header";
import { RichTextEditor } from "@/components/rich-text/editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCategory } from "@/context/category/hooks/use-categories";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { FiscalFields } from "@/features/products/components/fiscal-fields";
import { PriceMetrics } from "@/features/products/components/price-metrics";
import { formatBRL } from "@/utils/currency-formatter";
import { toDateInput, toIsoEnd, toIsoStart } from "@/utils/date-input";
import { ProductUnit } from "@/generated/prisma/enums";
import { orpc } from "@/lib/orpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ArrowLeft, Percent, Plus, Save } from "lucide-react";
import { CreateStockMovimentModal } from "@/components/modals/stock/create-stock-moviment-modal";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const unitLabels: Record<ProductUnit, string> = {
  UN: "Unidade",
  KG: "Quilograma",
  G: "Grama",
  L: "Litro",
  ML: "Mililitro",
  M: "Metro",
  M2: "Metro Quadrado",
  M3: "Metro Cúbico",
  CX: "Caixa",
  PC: "Peça",
  PAR: "Par",
  DZ: "Dúzia",
};

const productSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    categoryId: z.string().optional(),
    description: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    unit: z.enum(ProductUnit).optional(),
    costPrice: z.coerce.number().min(0, "Preço de custo deve ser positivo"),
    salePrice: z.coerce.number().min(0, "Preço de venda deve ser positivo"),
    // Desconto promocional: percentual + janela. Datas no formato do
    // `<input type="date">`; a conversão para instante acontece no submit.
    discountPercent: z.coerce
      .number()
      .min(0, "Desconto não pode ser negativo")
      .max(100, "Desconto não pode passar de 100%")
      .optional()
      .or(z.literal(NaN).transform(() => undefined)),
    discountStartsAt: z.string().optional(),
    discountEndsAt: z.string().optional(),
    minStock: z.coerce.number().min(0, "Estoque mínimo deve ser positivo"),
    isActive: z.boolean(),
    trackStock: z.boolean(),
    showOnCatalog: z.boolean(),
    thumbnail: z.string().optional(),
    prepTimeMinutes: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .or(z.literal(NaN).transform(() => undefined)),
    supplierId: z.string().optional(),
    // Cadastro fiscal (Fase B) — opcionais.
    ncm: z.string().optional(),
    cest: z.string().optional(),
    cfop: z.string().optional(),
    origem: z.string().optional(),
    cstIcms: z.string().optional(),
    cstPis: z.string().optional(),
    cstCofins: z.string().optional(),
    aliqIcms: z.coerce
      .number()
      .optional()
      .or(z.literal(NaN).transform(() => undefined)),
    aliqPis: z.coerce
      .number()
      .optional()
      .or(z.literal(NaN).transform(() => undefined)),
    aliqCofins: z.coerce
      .number()
      .optional()
      .or(z.literal(NaN).transform(() => undefined)),
    cClassTrib: z.string().optional(),
  })
  // Promoção sem prazo vira preço permanente por esquecimento — a validade
  // existe justamente para isso.
  .refine((data) => !data.discountPercent || Boolean(data.discountEndsAt), {
    message: "Informe até quando o desconto vale",
    path: ["discountEndsAt"],
  });

type ProductFormValues = z.infer<typeof productSchema>;

export function EditProductForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { id: productId } = useParams<{ id: string }>();
  const {
    data: { product },
  } = useSuspenseQuery(
    orpc.products.get.queryOptions({
      input: {
        id: productId,
      },
    }),
  );

  const updateProductMutation = useMutation(
    orpc.products.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.products.get.queryKey({
            input: {
              id: productId,
            },
          }),
        });

        toast.success("Produto atualizado com sucesso!");
        router.push(`/produtos`);
      },
      onError: () => {
        return toast.error("Erro ao atualizar o produto.");
      },
    }),
  );

  const { categories, isLoadingCategories } = useCategory();
  const { suppliers } = useSupplier();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: product.name,
      categoryId: product.categoryId || "",
      description: product.description || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      unit: product.unit || "UN",
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      discountPercent: product.discountPercent ?? undefined,
      discountStartsAt: toDateInput(product.discountStartsAt),
      discountEndsAt: toDateInput(product.discountEndsAt),
      minStock: product.minStock,
      thumbnail: product.thumbnail,
      isActive: product.isActive,
      trackStock: product.trackStock,
      showOnCatalog: product.isFeatured, // Mapping isFeatured to showOnCatalog
      prepTimeMinutes: product.prepTimeMinutes ?? undefined,
      supplierId: product.supplierId ?? "",
      ncm: product.ncm ?? "",
      cest: product.cest ?? "",
      cfop: product.cfop ?? "",
      origem: product.origem ?? "0",
      cstIcms: product.cstIcms ?? "",
      cstPis: product.cstPis ?? "",
      cstCofins: product.cstCofins ?? "",
      aliqIcms: product.aliqIcms ?? undefined,
      aliqPis: product.aliqPis ?? undefined,
      aliqCofins: product.aliqCofins ?? undefined,
      cClassTrib: product.cClassTrib ?? "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const costPrice = watch("costPrice");
  const salePrice = watch("salePrice");
  const discountPercent = Number(watch("discountPercent")) || 0;

  const onSubmit = async (data: ProductFormValues) => {
    updateProductMutation.mutate({
      id: productId,
      ...data,
      isFeatured: data.showOnCatalog,
      supplierId: data.supplierId || null,
      // Sem percentual, manda null nos três: é assim que se REMOVE uma
      // promoção pelo formulário.
      discountPercent: data.discountPercent ?? null,
      discountStartsAt: data.discountPercent
        ? toIsoStart(data.discountStartsAt ?? "")
        : null,
      discountEndsAt:
        data.discountPercent && data.discountEndsAt
          ? toIsoEnd(data.discountEndsAt)
          : null,
    });
  };

  const isUpdating = updateProductMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Produto"
        description={`Editando: ${product.name}`}
      >
        <Button size={"sm"} variant="outline" asChild>
          <Link href={`/produtos/${product.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="name">
                          Nome do Produto{" "}
                          <span className="text-destructive">*</span>
                        </FieldLabel>

                        <Input
                          id="name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Ex: Notebook Dell Inspiron 15"
                          disabled={isUpdating}
                          {...field}
                        />

                        {fieldState.invalid && (
                          <FieldError>{fieldState.error?.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <div className="space-y-2">
                    <Controller
                      name="categoryId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Categoria</FieldLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                            disabled={isUpdating}
                          >
                            <SelectTrigger id="category" className="w-full">
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingCategories ? (
                                <SelectItem value="loading" disabled>
                                  Carregando...
                                </SelectItem>
                              ) : (
                                categories.map((category) => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.id}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>

                          {fieldState.invalid && (
                            <FieldError>{fieldState.error?.message}</FieldError>
                          )}
                        </Field>
                      )}
                    />
                  </div>
                </div>

                <Controller
                  name="supplierId"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="supplierId">Fornecedor</FieldLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(val) =>
                          field.onChange(val === "__none__" ? "" : val)
                        }
                        disabled={isUpdating}
                      >
                        <SelectTrigger id="supplierId" className="w-full">
                          <SelectValue placeholder="Selecione um fornecedor (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
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
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="description">Descrição</FieldLabel>

                      <RichTextEditor
                        field={field.value}
                        onChange={field.onChange}
                        disabled={isUpdating}
                      />

                      {fieldState.invalid && (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      )}
                    </Field>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Controller
                    name="sku"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="sku">SKU</FieldLabel>

                        <Input
                          id="sku"
                          aria-invalid={fieldState.invalid}
                          placeholder="NB-001"
                          disabled={isUpdating}
                          {...field}
                        />

                        {fieldState.invalid && (
                          <FieldError>{fieldState.error?.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="barcode"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="barcode">
                          Código de Barras
                        </FieldLabel>

                        <Input
                          id="barcode"
                          aria-invalid={fieldState.invalid}
                          placeholder="7891234567890"
                          disabled={isUpdating}
                          {...field}
                        />

                        {fieldState.invalid && (
                          <FieldError>{fieldState.error?.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="unit"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="unit">Unidade</FieldLabel>

                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isUpdating}
                        >
                          <SelectTrigger id="unit">
                            <SelectValue placeholder="Selecione uma unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(unitLabels).map(([key, value]) => (
                              <SelectItem key={key} value={key}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {fieldState.invalid && (
                          <FieldError>{fieldState.error?.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  name="prepTimeMinutes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="prepTimeMinutes">
                        Tempo de preparo médio (min)
                      </FieldLabel>
                      <Input
                        id="prepTimeMinutes"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Ex.: 15"
                        disabled={isUpdating}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                      {fieldState.invalid && (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preços e Estoque</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">
                      Preço de Custo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      {...register("costPrice")}
                      aria-invalid={!!errors.costPrice}
                    />
                    {errors.costPrice && (
                      <p className="text-sm text-destructive">
                        {errors.costPrice.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salePrice">
                      Preço de Venda <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      {...register("salePrice")}
                      aria-invalid={!!errors.salePrice}
                    />
                    {errors.salePrice && (
                      <p className="text-sm text-destructive">
                        {errors.salePrice.message}
                      </p>
                    )}
                  </div>
                </div>

                <PriceMetrics
                  costPrice={Number(costPrice) || 0}
                  salePrice={Number(salePrice) || 0}
                  onSalePriceChange={(value) =>
                    setValue("salePrice", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />

                <div className="rounded-lg border p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Percent className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">
                      Desconto promocional
                    </h3>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Vale em todas as tabelas de preço. Passada a data, o preço
                    volta sozinho ao normal.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="discountPercent">Desconto (%)</Label>
                      <Input
                        id="discountPercent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        {...register("discountPercent")}
                        aria-invalid={!!errors.discountPercent}
                      />
                      {errors.discountPercent && (
                        <p className="text-sm text-destructive">
                          {errors.discountPercent.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountStartsAt">
                        Início (opcional)
                      </Label>
                      <Input
                        id="discountStartsAt"
                        type="date"
                        {...register("discountStartsAt")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountEndsAt">Vale até</Label>
                      <Input
                        id="discountEndsAt"
                        type="date"
                        {...register("discountEndsAt")}
                        aria-invalid={!!errors.discountEndsAt}
                      />
                      {errors.discountEndsAt && (
                        <p className="text-sm text-destructive">
                          {errors.discountEndsAt.message}
                        </p>
                      )}
                    </div>
                  </div>
                  {discountPercent > 0 && (
                    <p className="mt-3 text-sm">
                      Preço com desconto:{" "}
                      <span className="font-semibold tabular-nums">
                        {formatBRL(
                          Math.round(
                            (Number(salePrice) || 0) *
                              (1 - discountPercent / 100) *
                              100,
                          ) / 100,
                        )}
                      </span>
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex h-7 items-center justify-between">
                      <Label htmlFor="currentStock">Estoque Atual</Label>
                      <CreateStockMovimentModal
                        product={{ id: product.id, name: product.name }}
                        onSuccess={() =>
                          queryClient.invalidateQueries({
                            queryKey: orpc.products.get.queryKey({
                              input: { id: productId },
                            }),
                          })
                        }
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-7"
                            aria-label="Adicionar estoque"
                          >
                            <Plus className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                    <Input
                      id="currentStock"
                      key={product.currentStock}
                      type="number"
                      defaultValue={product.currentStock}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Use movimentações para alterar o estoque
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex h-7 items-center">
                      <Label htmlFor="minStock">
                        Estoque Mínimo{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                    </div>
                    <Input
                      id="minStock"
                      type="number"
                      {...register("minStock")}
                      aria-invalid={!!errors.minStock}
                    />
                    {errors.minStock && (
                      <p className="text-sm text-destructive">
                        {errors.minStock.message}
                      </p>
                    )}
                  </div>
                  {/* <div className="space-y-2">
                    <Label htmlFor="location">Localização</Label>
                    <Input id="location" {...register("location")} />
                  </div> */}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Imagem do Produto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Controller
                  name="thumbnail"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field className="text-center">
                      <Uploader value={field.value} onChange={field.onChange} />
                      <FieldDescription>
                        Formatos aceitos: JPG, PNG, GIF
                        <br />
                        Tamanho máximo: 5MB
                      </FieldDescription>
                    </Field>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive">Produto Ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Disponível para venda
                    </p>
                  </div>
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>

                {/* Status no ERP — SOMENTE LEITURA. Quem manda nele é o
                    Oracle: um switch editável mentiria, porque o próximo sync
                    desfaria a edição. É informação, não controle. */}
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">Status no ERP</span>
                    {product.erpActive === null ||
                    product.erpActive === undefined ? (
                      <Badge variant="secondary">Nunca sincronizado</Badge>
                    ) : product.erpActive ? (
                      <Badge className="bg-green-500 text-green-50">
                        Ativo no ERP
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Inativo no ERP</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.erpSyncedAt
                      ? `Código ${product.erpCode ?? "—"} · sincronizado em ${new Date(
                          product.erpSyncedAt,
                        ).toLocaleString("pt-BR")}`
                      : "Vem do cadastro do ERP; não é editável aqui."}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="trackStock">Controlar Estoque</Label>
                    <p className="text-xs text-muted-foreground">
                      Rastrear quantidade
                    </p>
                  </div>
                  <Controller
                    name="trackStock"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="trackStock"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showOnCatalog">
                      Exibir no Catálogo Online
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Visível para clientes
                    </p>
                  </div>
                  <Controller
                    name="showOnCatalog"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="showOnCatalog"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* CADASTRO FISCAL — opcional; obrigatório apenas quando for emitir NFCe. */}
            <FiscalFields control={control} />

            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={isUpdating}>
                <Save className="h-4 w-4 mr-2" />
                {isUpdating ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full bg-transparent"
                asChild
              >
                <Link href={`/produtos/${product.id}`}>Cancelar</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
