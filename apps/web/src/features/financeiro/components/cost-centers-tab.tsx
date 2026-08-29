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
  useCostCenters,
  useCreateCostCenter,
  useDeleteCostCenter,
  useUpdateCostCenter,
} from "@/features/financeiro/hooks/use-financeiro";
import type { FinanceCostCenter } from "@/features/financeiro/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function CostCenterDialog({
  open,
  onOpenChange,
  costCenter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter: FinanceCostCenter | null;
}) {
  const createCostCenter = useCreateCostCenter();
  const updateCostCenter = useUpdateCostCenter();
  const isEdit = Boolean(costCenter);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      costCenter
        ? {
            name: costCenter.name,
            description: costCenter.description ?? "",
            isActive: costCenter.isActive,
          }
        : { name: "", description: "", isActive: true },
    );
  }, [open, costCenter, form]);

  const isLoading = createCostCenter.isPending || updateCostCenter.isPending;

  const onSubmit = (data: FormValues) => {
    if (costCenter) {
      updateCostCenter.mutate(
        {
          id: costCenter.id,
          name: data.name,
          description: data.description || null,
          isActive: data.isActive,
        },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }
    createCostCenter.mutate(
      { name: data.name, description: data.description || undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar centro de custo" : "Novo centro de custo"}
          </DialogTitle>
          <DialogDescription>
            Onde o dinheiro foi gasto ou ganho — loja, frota, marketing. Usado
            para separar o resultado por área no lançamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Ex.: Loja Centro"
                    disabled={isLoading}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    Descrição (opcional)
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="O que este centro agrupa"
                    disabled={isLoading}
                  />
                </Field>
              )}
            />
            {/* Só na edição: criar já nasce ativo, e o campo a mais na criação
                só atrapalharia. Desativar preserva o histórico dos lançamentos
                que já apontam para ele — é a alternativa a excluir. */}
            {isEdit && (
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <div className="flex flex-col">
                        <FieldLabel htmlFor={field.name}>Ativo</FieldLabel>
                        <span className="text-xs text-muted-foreground">
                          Inativo some da escolha em novos lançamentos, mas os
                          antigos continuam apontando para ele.
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
            )}
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

export function CostCentersTab() {
  // `true`: a lista de cadastro mostra inativos também, senão eles ficariam
  // impossíveis de reativar.
  const { data, isPending } = useCostCenters(true);
  const deleteCostCenter = useDeleteCostCenter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceCostCenter | null>(null);

  const costCenters = data?.costCenters ?? [];

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
          Novo centro de custo
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table stacked>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : costCenters.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum centro de custo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              costCenters.map((costCenter) => (
                <TableRow key={costCenter.id}>
                  <TableCell data-label="Nome" className="font-medium">
                    {costCenter.name}
                  </TableCell>
                  <TableCell
                    data-label="Descrição"
                    className="text-muted-foreground"
                  >
                    {costCenter.description ?? "—"}
                  </TableCell>
                  <TableCell data-label="Status">
                    {costCenter.isActive ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${costCenter.name}`}
                        onClick={() => {
                          setEditing(costCenter);
                          setOpen(true);
                        }}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${costCenter.name}`}
                        onClick={() =>
                          deleteCostCenter.mutate({ id: costCenter.id })
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
      <CostCenterDialog
        open={open}
        onOpenChange={setOpen}
        costCenter={editing}
      />
    </div>
  );
}
