"use client";
import {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from "@/components/ui/shadcn-io/tags";
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
import { Check, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import type { CategoryCatalog } from "../../types/category";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  formatCurrencyInput,
  parseCurrencyPenny,
} from "@/utils/currency-formatter";

interface FiltersCatalogProps {
  categories: CategoryCatalog[];
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

export function FiltersCatalog({
  categories: mockedCategories,
}: FiltersCatalogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalIsOpen] = useState(false);
  const [categorySlugs, setCategorySlugs] = useQueryState("categories");
  const [minValue, setMinValue] = useQueryState("min_value");
  const [maxValue, setMaxValue] = useQueryState("max_value");

  const form = useForm<z.infer<typeof formFilterSchema>>({
    resolver: zodResolver(formFilterSchema),
    defaultValues: {
      categoryIds: selectedIds,
      minValue: minValue ?? undefined,
      maxValue: maxValue ?? undefined,
    },
  });

  useEffect(() => {
    form.setValue(
      "minValue",
      minValue ? formatCurrencyInput(minValue.toString()) : undefined,
    );
    form.setValue(
      "maxValue",
      maxValue ? formatCurrencyInput(maxValue.toString()) : undefined,
    );
    form.setValue("categoryIds", selectedIds);
  }, [minValue, maxValue, selectedIds, form]);

  const handleRemove = (id: string) => {
    if (!selectedIds.includes(id)) {
      return;
    }

    setSelectedIds((prev) => prev.filter((v) => v !== id));
  };

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      handleRemove(id);
      return;
    }
    setSelectedIds([id]);
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  const getSelectedCategories = () => {
    return mockedCategories.filter((cat) => selectedIds.includes(cat.id));
  };

  const handleApplyFilters = () => {
    if (getSelectedCategories().length >= 1) {
      setCategorySlugs(
        getSelectedCategories()
          .map((cat) => cat.slug.toLowerCase())
          .join(","),
      );
    } else {
      setCategorySlugs(null);
    }
    setMinValue(parseCurrencyPenny(form.getValues("minValue")) ?? null);
    setMaxValue(parseCurrencyPenny(form.getValues("maxValue")) ?? null);
    setModalIsOpen(false);
    form.reset({
      categoryIds: [],
      minValue: undefined,
      maxValue: undefined,
    });
  };

  const handleClearFilters = () => {
    setSelectedIds([]);
    setModalIsOpen(false);
    setCategorySlugs(null);
    setMinValue(null);
    setMaxValue(null);
    form.reset();
  };

  useEffect(() => {
    if (categorySlugs) {
      const slugsFromUrl = categorySlugs
        .split(",")
        .map((s) => s.trim().toLowerCase());

      const idsFromSlugs = mockedCategories
        .filter((cat) => slugsFromUrl.includes(cat.slug.toLowerCase()))
        .map((cat) => cat.id);

      setSelectedIds(idsFromSlugs);
    } else {
      setSelectedIds([]);
    }
  }, [categorySlugs, mockedCategories]);

  return (
    <Sheet open={modalOpen} onOpenChange={setModalIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <Filter className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full px-4">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Filtre seus produtos aqui</SheetDescription>
        </SheetHeader>
        <Tags className="w-full">
          <TagsTrigger placeholder="Buscar categoria...">
            {getSelectedCategories().map((currentCategory) => (
              <TagsValue
                key={currentCategory.id}
                onRemove={() => handleRemove(currentCategory.id)}
              >
                {currentCategory.name}
              </TagsValue>
            ))}
          </TagsTrigger>
          <TagsContent>
            <TagsInput placeholder="Selecionar categoria..." />
            <TagsList>
              <TagsEmpty />
              <TagsGroup>
                {mockedCategories.map((currentCategory) => (
                  <TagsItem
                    key={currentCategory.id}
                    onSelect={() => handleSelect(currentCategory.id)}
                    value={currentCategory.name}
                  >
                    {currentCategory.name}
                    {isSelected(currentCategory.id) && (
                      <Check className="text-muted-foreground" size={14} />
                    )}
                  </TagsItem>
                ))}
              </TagsGroup>
            </TagsList>
          </TagsContent>
        </Tags>

        <div className="flex flex-row gap-2">
          <div className="flex flex-col gap-2">
            <Controller
              name="minValue"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="minValue">Valor mínimo</FieldLabel>
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
                  <FieldLabel htmlFor="maxValue">Valor máximo</FieldLabel>
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
