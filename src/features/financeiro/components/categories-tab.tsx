"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/features/financeiro/hooks/use-financeiro";
import { CATEGORY_TYPE_LABEL } from "@/features/financeiro/lib/labels";
import type {
  CategoryType,
  FinanceCategory,
} from "@/features/financeiro/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const TYPES: CategoryType[] = ["REVENUE", "EXPENSE", "COST"];

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  type: z.enum(["REVENUE", "EXPENSE", "COST"]),
  color: z.string(),
  isOperational: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: FinanceCategory | null;
}) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isEdit = Boolean(category);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      color: "#6366f1",
      isOperational: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: category?.name ?? "",
      type: category?.type ?? "EXPENSE",
      color: category?.color ?? "#6366f1",
      isOperational: category?.isOperational ?? true,
    });
  }, [open, category, form]);

  const isLoading = createCategory.isPending || updateCategory.isPending;

  const onSubmit = (data: FormValues) => {
    const onSuccess = () => {
      onOpenChange(false);
      form.reset();
    };
    if (category) {
      updateCategory.mutate(
        {
          id: category.id,
          name: data.name,
          color: data.color || null,
          isOperational: data.isOperational,
        },
        { onSuccess },
      );
    } else {
      createCategory.mutate(
        {
          name: data.name,
          type: data.type,
          color: data.color || undefined,
          isOperational: data.isOperational,
        },
        { onSuccess },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
          <DialogDescription>
            Categorias de receita, despesa e custo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
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
                    placeholder="Ex.: Aluguel"
                    disabled={isLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <div className="flex items-start gap-4">
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit}
                    >
                      <SelectTrigger id={field.name} disabled={isLoading}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {CATEGORY_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                name="color"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Cor</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="color"
                      className="h-9 w-16 p-1"
                      disabled={isLoading}
                    />
                  </Field>
                )}
              />
            </div>
            <Controller
              name="isOperational"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div className="flex flex-col">
                      <FieldLabel htmlFor={field.name}>Operacional</FieldLabel>
                      <span className="text-xs text-muted-foreground">
                        Desligue para não-operacional/financeiro (juros, multas,
                        receitas financeiras) — separa no DRO.
                      </span>
                    </div>
                    <Switch
                      id={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </div>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancelar
              </Button>
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
}

export function CategoriesTab() {
  const { data, isPending } = useCategories(true);
  const deleteCategory = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCategory | null>(null);

  const categories = data?.categories ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Nova categoria
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhuma categoria cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{
                          backgroundColor: category.color ?? "var(--muted)",
                        }}
                      />
                      {category.name}
                    </span>
                  </TableCell>
                  <TableCell>{CATEGORY_TYPE_LABEL[category.type]}</TableCell>
                  <TableCell>
                    {category.isOperational ? (
                      <Badge variant="secondary">Operacional</Badge>
                    ) : (
                      <Badge variant="outline">Não-operacional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {category.isActive ? (
                      <Badge variant="secondary">Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(category);
                          setOpen(true);
                        }}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          deleteCategory.mutate({ id: category.id })
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <CategoryDialog open={open} onOpenChange={setOpen} category={editing} />
    </div>
  );
}
