"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategory } from "@/context/category/hooks/use-categories";
import { toDateInput, toIsoEnd, toIsoStart } from "@/utils/date-input";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useCategoryDiscounts,
  useDeleteCategoryDiscount,
  useSetCategoryDiscount,
} from "../hooks/use-precos";

function formatRange(startsAt: string | null, endsAt: string): string {
  const end = new Date(endsAt).toLocaleDateString("pt-BR");
  if (!startsAt) return `até ${end}`;
  return `${new Date(startsAt).toLocaleDateString("pt-BR")} → ${end}`;
}

interface DiscountDraft {
  categoryId: string;
  percent: string;
  startsAt: string;
  endsAt: string;
}

const EMPTY_DRAFT: DiscountDraft = {
  categoryId: "",
  percent: "",
  startsAt: "",
  endsAt: "",
};

function DiscountDialog({
  priceListId,
  initial,
  trigger,
}: {
  priceListId: string;
  initial?: DiscountDraft;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DiscountDraft>(initial ?? EMPTY_DRAFT);
  const { categories, isLoadingCategories } = useCategory();
  const save = useSetCategoryDiscount();

  const percent = Number(draft.percent);
  const canSave =
    Boolean(draft.categoryId) &&
    Number.isFinite(percent) &&
    percent > 0 &&
    percent <= 100 &&
    Boolean(draft.endsAt);

  const handleSave = () => {
    save.mutate(
      {
        priceListId,
        categoryId: draft.categoryId,
        percentDiscount: percent,
        startsAt: toIsoStart(draft.startsAt),
        endsAt: toIsoEnd(draft.endsAt),
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(initial ?? EMPTY_DRAFT);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desconto por categoria</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="discount-category">Categoria</FieldLabel>
            <Select
              value={draft.categoryId}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, categoryId: value }))
              }
              disabled={Boolean(initial) || isLoadingCategories}
            >
              <SelectTrigger id="discount-category">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="discount-percent">Desconto (%)</FieldLabel>
            <Input
              id="discount-percent"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              placeholder="20"
              value={draft.percent}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, percent: event.target.value }))
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="discount-start">
                Início (opcional)
              </FieldLabel>
              <Input
                id="discount-start"
                type="date"
                value={draft.startsAt}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    startsAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="discount-end">Vale até</FieldLabel>
              <Input
                id="discount-end"
                type="date"
                value={draft.endsAt}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, endsAt: event.target.value }))
                }
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Vale para as subcategorias também. Passada a data, o preço volta
            sozinho ao normal.
          </p>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={handleSave} disabled={!canSave || save.isPending}>
            {save.isPending ? <Spinner /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDiscountsCard({
  priceListId,
}: {
  priceListId: string;
}) {
  const { data, isLoading } = useCategoryDiscounts(priceListId);
  const remove = useDeleteCategoryDiscount();
  const discounts = data?.discounts ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Descontos por categoria</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Um percentual para a categoria inteira, com prazo. Vale para
            produtos cadastrados depois também.
          </p>
        </div>
        <DiscountDialog
          priceListId={priceListId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="size-4" />
              Adicionar
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center">
            <Spinner />
          </div>
        ) : discounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum desconto por categoria nesta tabela.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((discount) => (
                <TableRow key={discount.id}>
                  <TableCell className="font-medium">
                    {discount.categoryName}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {discount.percentDiscount}%
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {formatRange(discount.startsAt, discount.endsAt)}
                      {!discount.isActive && (
                        <Badge variant="outline">Fora da vigência</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <DiscountDialog
                        priceListId={priceListId}
                        initial={{
                          categoryId: discount.categoryId,
                          percent: String(discount.percentDiscount),
                          startsAt: toDateInput(discount.startsAt),
                          endsAt: toDateInput(discount.endsAt),
                        }}
                        trigger={
                          <Button size="sm" variant="ghost">
                            Editar
                          </Button>
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remover desconto de ${discount.categoryName}`}
                        onClick={() => remove.mutate({ id: discount.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
