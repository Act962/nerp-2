"use client";

import { Uploader } from "@/components/file-uploader/uploader";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCategory } from "@/context/category/hooks/use-categories";
import { ProductUnit } from "@/generated/prisma/enums";
import { ProductSchema, type ProductType } from "@/schemas/product";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { RichTextEditor } from "../../../../../components/rich-text/editor";
import { useCreateProduct } from "@/features/products/hooks/use-products";
import { FiscalFields } from "@/features/products/components/fiscal-fields";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";

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

export function CreateProductForm() {
  const form = useForm<ProductType>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      description: "",
      sku: "",
      barcode: "",
      unit: ProductUnit.UN,
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      location: "",
      images: [],
      thumbnail: "",
      isActive: true,
      isFeatured: false,
      trackStock: true,
      supplierId: "",
      // Fiscal — default só pra origem (0 = nacional, cobre a maioria).
      origem: "0",
    },
  });
  const router = useRouter();

  const { categories } = useCategory();
  const { suppliers } = useSupplier();

  const mutation = useCreateProduct();

  const handleSubmit = async (data: ProductType) => {
    mutation.mutate(
      {
        name: data.name,
        description: data.description,
        sku: data.sku,
        unit: data.unit,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currentStock: data.currentStock,
        categoryId: data.categoryId,
        minStock: data.minStock,
        maxStock: data.maxStock,
        location: data.location,
        images: data.images,
        thumbnail: data.thumbnail,
        weight: data.weight,
        length: data.length,
        width: data.width,
        height: data.height,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        trackStock: data.trackStock,
        barcode: data.barcode,
        prepTimeMinutes: data.prepTimeMinutes,
        supplierId: data.supplierId || undefined,
        ncm: data.ncm || undefined,
        cest: data.cest || undefined,
        cfop: data.cfop || undefined,
        origem: data.origem || undefined,
        cstIcms: data.cstIcms || undefined,
        cstPis: data.cstPis || undefined,
        cstCofins: data.cstCofins || undefined,
        aliqIcms: data.aliqIcms,
        aliqPis: data.aliqPis,
        aliqCofins: data.aliqCofins,
        cClassTrib: data.cClassTrib || undefined,
      },
      {
        onSuccess: () => {
          router.push("/produtos");
        },
      },
    );
  };

  const isCreating = mutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* ---- INFORMAÇÕES BÁSICAS ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nome */}
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
                        disabled={isCreating}
                        autoFocus
                        {...field}
                      />

                      {fieldState.invalid && (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="categoryId">Categoria</FieldLabel>

                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isCreating}
                      >
                        <SelectTrigger
                          id="categoryId"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
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
                      disabled={isCreating}
                    >
                      <SelectTrigger id="supplierId">
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
                      disabled={isCreating}
                    />

                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              {/* SKU / BARCODE / UNIT */}
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
                        disabled={isCreating}
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
                        disabled={isCreating}
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
                        disabled={isCreating}
                      >
                        <SelectTrigger id="unit" disabled={isCreating}>
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
                      disabled={isCreating}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                    />
                    <FieldDescription>
                      Usado para estimar o tempo dos pedidos na cozinha. Quando
                      vazio, o KDS usa 15 min como padrão.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </CardContent>
          </Card>

          {/* ---- PREÇOS E ESTOQUE ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Preços e Estoque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preços */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">
                    Preço de Custo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    disabled={isCreating}
                    placeholder="0,00"
                    {...form.register("costPrice", { valueAsNumber: true })}
                  />
                  <FieldError>
                    {form.formState.errors.costPrice?.message}
                  </FieldError>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salePrice">
                    Preço de Venda <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    disabled={isCreating}
                    placeholder="0,00"
                    {...form.register("salePrice", { valueAsNumber: true })}
                  />
                  <FieldError>
                    {form.formState.errors.salePrice?.message}
                  </FieldError>
                </div>

                <div className="space-y-2">
                  <Label>Margem de Lucro</Label>
                  <Input
                    value={
                      form.watch("costPrice") > 0
                        ? (
                            ((form.watch("salePrice") -
                              form.watch("costPrice")) /
                              form.watch("costPrice")) *
                            100
                          ).toFixed(2) + "%"
                        : "0.00%"
                    }
                    placeholder="0.00%"
                    disabled
                  />
                </div>
              </div>

              {/* Estoque */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currentStock">Estoque Inicial</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    placeholder="0"
                    disabled={isCreating}
                    {...form.register("currentStock", { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minStock">Estoque Mínimo</Label>
                  <Input
                    id="minStock"
                    type="number"
                    placeholder="0"
                    disabled={isCreating}
                    {...form.register("minStock", { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Localização</Label>
                  <Input
                    id="location"
                    placeholder="Ex: Prateleira 1"
                    disabled={isCreating}
                    {...form.register("location")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CADASTRO FISCAL — na coluna PRINCIPAL (mais larga), fica melhor. */}
          <FiscalFields control={form.control} />
        </div>

        {/* ----------- COLUNA LATERAL ----------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagem do Produto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                name="thumbnail"
                control={form.control}
                render={({ field }) => (
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
              {/* isActive */}
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="items-center">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="isActive">Produto Ativo</Label>
                      <p className="text-xs text-muted-foreground">
                        Disponível para venda
                      </p>
                    </div>
                    <Switch
                      id="isActive"
                      disabled={isCreating}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                )}
              />

              <Controller
                name="trackStock"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="items-center">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="trackStock">Controlar Estoque</Label>
                      <p className="text-xs text-muted-foreground">
                        Rastrear quantidade
                      </p>
                    </div>
                    <Switch
                      id="trackStock"
                      disabled={isCreating}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                )}
              />

              {/* isFeatured */}
              <Controller
                name="isFeatured"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="items-center">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="isFeatured">
                        Exibir no Catálogo Online
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Visível para clientes
                      </p>
                    </div>
                    <Switch
                      id="isFeatured"
                      disabled={isCreating}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                )}
              />
            </CardContent>
          </Card>

          {/* AÇÕES */}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating && <Spinner />}
              Salvar Produto
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full bg-transparent"
              disabled={isCreating}
              asChild
            >
              <Link href="/produtos">Cancelar</Link>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
