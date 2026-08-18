import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Check, ChevronsUpDown, Filter, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import type { Categories } from "./products-table";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  formatCurrencyInput,
  parseCurrencyPenny,
} from "@/utils/currency-formatter";

interface FilterProductsProps {
  categories: Categories[];
}

const formFilterSchema = z
  .object({
    categoryIds: z.array(z.string()),
    sku: z.string().optional(),
    minValue: z.string().optional(),
    maxValue: z.string().optional(),
  })
  .refine((data) => {
    if (data.minValue && data.maxValue) {
      return data.minValue <= data.maxValue;
    }
    return true;
  }, "O valor minimo deve ser menor que o valor maximo");

export function FilterProducts({ categories }: FilterProductsProps) {
  const [category, setCategory] = useQueryState("category");
  const [sku, setSku] = useQueryState("sku");
  const [minValue, setMinValue] = useQueryState("min_value");
  const [maxValue, setMaxValue] = useQueryState("max_value");

  const [openProduct, setOpenProduct] = useState(false);
  const [modalOpen, setModalIsOpen] = useState(false);

  const categorySlugs =
    category?.split(",").map((cat) => cat.toLowerCase()) || [];

  const selectedCategories = categories.filter((cat) =>
    categorySlugs.includes(cat.slug.toLowerCase()),
  );
  const form = useForm<z.infer<typeof formFilterSchema>>({
    resolver: zodResolver(formFilterSchema),
    defaultValues: {
      categoryIds: selectedCategories.map((cat) => cat.id),
      sku: sku ?? undefined,
      minValue: minValue ?? undefined,
      maxValue: maxValue ?? undefined,
    },
  });

  const handleApplyFilters = () => {
    // Aplica categorias
    if (form.getValues("categoryIds").length >= 1) {
      const selectedCats = categories.filter((cat) =>
        form.getValues("categoryIds").includes(cat.id),
      );
      setCategory(selectedCats.map((cat) => cat.slug.toLowerCase()).join(","));
    } else {
      setCategory(null);
    }

    // Aplica outros filtros
    setSku(form.getValues("sku") || null);
    setMinValue(parseCurrencyPenny(form.getValues("minValue")) || null);
    setMaxValue(parseCurrencyPenny(form.getValues("maxValue")) || null);

    setModalIsOpen(false);
  };

  const handleClearFilters = () => {
    form.reset({
      categoryIds: [],
      sku: "",
      minValue: "",
      maxValue: "",
    });
    setCategory(null);
    setSku(null);
    setMinValue(null);
    setMaxValue(null);

    setModalIsOpen(false);
  };

  return (
    <Sheet open={modalOpen} onOpenChange={setModalIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full px-4">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Filtre seus produtos aqui</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          <Controller
            name="categoryIds"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Categorias</FieldLabel>
                <Popover open={openProduct} onOpenChange={setOpenProduct}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {field.value && field.value.length > 0 ? (
                        field.value.length === 1 ? (
                          categories.find((cat) => cat.id === field.value[0])
                            ?.name
                        ) : (
                          `${field.value.length} categorias selecionadas`
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Selecione uma categoria
                        </span>
                      )}
                      <ChevronsUpDown className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0  w-full" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto</CommandEmpty>
                        <CommandGroup>
                          {categories.map((category) => (
                            <CommandItem
                              key={category.id}
                              value={`${category.name}-${category.id}`}
                              className="cursor-pointer"
                              onSelect={() => {
                                const currentValue = field.value || [];

                                if (currentValue.includes(category.id)) {
                                  field.onChange(
                                    currentValue.filter(
                                      (id) => id !== category.id,
                                    ),
                                  );
                                } else {
                                  field.onChange([
                                    ...currentValue,
                                    category.id,
                                  ]);
                                }

                                setOpenProduct(false);
                              }}
                            >
                              {field.value && (
                                <Check
                                  className={cn(
                                    "size-4",
                                    field.value.includes(category.id)
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                              )}
                              {category.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">Código SKU</Label>
          <Controller
            name="sku"
            control={form.control}
            render={({ field }) => (
              <InputGroup>
                <InputGroupInput
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  id="sku"
                  placeholder="Código SKU"
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => field.onChange("")}
                  className="cursor-pointer"
                >
                  <X />
                </InputGroupAddon>
              </InputGroup>
            )}
          />
        </div>

        <div className="flex flex-row gap-2">
          <div className="flex flex-col gap-2">
            <Controller
              name="minValue"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="minValue">Valor mínimo</Label>
                  <InputGroup>
                    <InputGroupInput
                      id="minValue"
                      min={0}
                      value={formatCurrencyInput(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0,00"
                      className="w-full"
                    />
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Controller
              name="maxValue"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <Label htmlFor="maxValue">Valor máximo</Label>
                  <InputGroup>
                    <InputGroupInput
                      id="maxValue"
                      min={0}
                      value={formatCurrencyInput(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0,00"
                      className="w-full"
                    />
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />
          </div>
        </div>

        <SheetFooter>
          <Button type="submit" onClick={handleApplyFilters}>
            Aplicar
          </Button>
          <SheetClose asChild>
            <Button onClick={handleClearFilters} variant="outline">
              Limpar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
