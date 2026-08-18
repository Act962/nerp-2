"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { KitchenColumn } from "../hooks/use-pedidos-columns";
import {
  useMutationCreateColumn,
  useMutationUpdateColumn,
} from "../hooks/use-pedidos-columns";
import { ColumnIcon } from "./column-icon";

// Ícones lucide sugeridos para as etapas da cozinha (o campo aceita qualquer
// nome lucide ou emoji; estes são só atalhos de um clique).
const ICON_PRESETS = [
  "ChefHat",
  "CookingPot",
  "Flame",
  "Soup",
  "Utensils",
  "UtensilsCrossed",
  "BellRing",
  "CheckCheck",
  "Truck",
  "Package",
  "Clock",
  "Hourglass",
  "Pizza",
  "Sandwich",
  "Salad",
  "Beef",
  "Coffee",
  "Beer",
] as const;

const columnFormSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, "Cor inválida"),
  icon: z.string().optional(),
  description: z.string().optional(),
  wipLimit: z.string().optional(),
  isActive: z.boolean(),
  isInitial: z.boolean(),
  showOnTv: z.boolean(),
  isFinal: z.boolean(),
});

type ColumnFormValues = z.infer<typeof columnFormSchema>;

interface ColumnFormProps {
  column?: KitchenColumn; // ausente ⇒ criação
  children: React.ReactNode; // trigger
}

function toDefaults(column?: KitchenColumn): ColumnFormValues {
  return {
    name: column?.name ?? "",
    color: column?.color ?? "#2563eb",
    icon: column?.icon ?? "",
    description: column?.description ?? "",
    wipLimit: column?.wipLimit != null ? String(column.wipLimit) : "",
    isActive: column?.isActive ?? true,
    isInitial: column?.isInitial ?? false,
    showOnTv: column?.showOnTv ?? false,
    isFinal: column?.isFinal ?? false,
  };
}

export function ColumnForm({ column, children }: ColumnFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(column);

  const createColumn = useMutationCreateColumn();
  const updateColumn = useMutationUpdateColumn();
  const isLoading = createColumn.isPending || updateColumn.isPending;

  const form = useForm<ColumnFormValues>({
    resolver: zodResolver(columnFormSchema),
    defaultValues: toDefaults(column),
  });

  useEffect(() => {
    if (open) form.reset(toDefaults(column));
  }, [open]);

  const onSubmit = (data: ColumnFormValues) => {
    const wipLimit = data.wipLimit ? Number(data.wipLimit) : null;
    const payload = {
      name: data.name,
      color: data.color,
      icon: data.icon || undefined,
      description: data.description || undefined,
      wipLimit: wipLimit && Number.isFinite(wipLimit) ? wipLimit : null,
      isInitial: data.isInitial,
      showOnTv: data.showOnTv,
      isFinal: data.isFinal,
    };

    if (isEdit && column) {
      updateColumn.mutate(
        { id: column.id, isActive: data.isActive, ...payload },
        { onSuccess: () => setOpen(false) },
      );
    } else {
      createColumn.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar coluna" : "Nova coluna"}</DialogTitle>
          <DialogDescription>
            Configure a nomenclatura, a cor e o comportamento da coluna no
            kanban.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="flex-1">
                  <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ex.: Em Preparo"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="color"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="w-20">
                  <FieldLabel htmlFor={field.name}>Cor</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="color"
                    className="h-9 p-1"
                    aria-invalid={fieldState.invalid}
                    disabled={isLoading}
                  />
                </Field>
              )}
            />
          </div>

          <div className="flex gap-3">
            <Controller
              name="icon"
              control={form.control}
              render={({ field }) => (
                <Field className="flex-1">
                  <FieldLabel htmlFor={field.name}>Ícone (opcional)</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ex.: ChefHat ou 🔥"
                    disabled={isLoading}
                  />
                  {/* Presets: clique para preencher; clique de novo p/ limpar. */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ICON_PRESETS.map((name) => {
                      const selected = field.value === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-label={name}
                          aria-pressed={selected}
                          disabled={isLoading}
                          onClick={() => field.onChange(selected ? "" : name)}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                            selected &&
                              "border-primary bg-primary/10 text-foreground",
                          )}
                        >
                          <ColumnIcon icon={name} className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            />
            <Controller
              name="wipLimit"
              control={form.control}
              render={({ field }) => (
                <Field className="w-32">
                  <FieldLabel htmlFor={field.name}>Limite WIP</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="number"
                    min={1}
                    placeholder="sem limite"
                    disabled={isLoading}
                  />
                </Field>
              )}
            />
          </div>

          <Controller
            name="description"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  Descrição (opcional)
                </FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={2}
                  disabled={isLoading}
                />
              </Field>
            )}
          />

          <div className="space-y-3 rounded-md border p-3">
            <ToggleRow
              control={form.control}
              name="isActive"
              label="Visível"
              description="Exibe a coluna no board da cozinha."
              disabled={isLoading}
            />
            <ToggleRow
              control={form.control}
              name="isInitial"
              label="Coluna de entrada"
              description="Novos pedidos caem aqui (apenas uma por organização)."
              disabled={isLoading}
            />
            <ToggleRow
              control={form.control}
              name="showOnTv"
              label="Mostrar na TV"
              description="Alimenta o painel público da TV."
              disabled={isLoading}
            />
            <ToggleRow
              control={form.control}
              name="isFinal"
              label="Terminal"
              description="Coluna final: cards somem após a janela de recentes."
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
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

interface ToggleRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: keyof ColumnFormValues;
  label: string;
  description: string;
  disabled?: boolean;
}

function ToggleRow({
  control,
  name,
  label,
  description,
  disabled,
}: ToggleRowProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}
