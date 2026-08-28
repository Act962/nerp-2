"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { useProducts } from "@/features/products/hooks/use-products";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Percent, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryDiscountsCard } from "./category-discounts-card";
import {
  useDeletePriceList,
  useDeleteProductPrice,
  useListProductPrices,
  useSetProductPrice,
  useUpdatePriceList,
} from "../hooks/use-precos";

type Mode = "FIXED" | "PERCENT_DISCOUNT";

interface PriceListRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  productPriceCount: number;
}

export function PriceTableEditor({ priceList }: { priceList: PriceListRow }) {
  const { data: tiers = [], isLoading } = useListProductPrices({
    priceListId: priceList.id,
  });
  const update = useUpdatePriceList();
  const del = useDeletePriceList();

  // Agrupa faixas por produto pra facilitar visualização (produto A: 1un R$10,
  // 12un R$8; produto B: 1un −20%, etc.)
  const byProduct = useMemo(() => {
    const m = new Map<
      string,
      { productName: string; productSalePrice: number; rows: typeof tiers }
    >();
    for (const t of tiers) {
      const cur = m.get(t.productId);
      if (cur) {
        cur.rows.push(t);
      } else {
        m.set(t.productId, {
          productName: t.productName,
          productSalePrice: t.productSalePrice,
          rows: [t],
        });
      }
    }
    return Array.from(m.entries());
  }, [tiers]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle>{priceList.name}</CardTitle>
            {priceList.isDefault && <Badge variant="secondary">padrão</Badge>}
            {!priceList.isActive && <Badge variant="outline">inativa</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <AddTierDialog priceListId={priceList.id} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Opções
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Ativa</span>
                  <Switch
                    checked={priceList.isActive}
                    onCheckedChange={(v) =>
                      update.mutate({ id: priceList.id, isActive: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Padrão da org</span>
                  <Switch
                    checked={priceList.isDefault}
                    onCheckedChange={(v) =>
                      update.mutate({ id: priceList.id, isDefault: v })
                    }
                  />
                </div>
                {!priceList.isDefault && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => del.mutate({ id: priceList.id })}
                    disabled={del.isPending}
                  >
                    Excluir tabela
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <Spinner />}
          {!isLoading && byProduct.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma faixa cadastrada nesta tabela. Adicione a primeira em "+
              Adicionar faixa".
            </p>
          )}
          {byProduct.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço base</TableHead>
                    <TableHead>A partir de</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Preço final</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProduct.map(([productId, group]) =>
                    group.rows
                      .sort((a, b) => a.minQuantity - b.minQuantity)
                      .map((row, i) => (
                        <TierRow
                          key={row.id}
                          row={row}
                          showProduct={i === 0}
                          productName={group.productName}
                          productSalePrice={group.productSalePrice}
                        />
                      )),
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryDiscountsCard priceListId={priceList.id} />
    </div>
  );
}

function TierRow({
  row,
  showProduct,
  productName,
  productSalePrice,
}: {
  row: {
    id: string;
    minQuantity: number;
    pricingMode: "FIXED" | "PERCENT_DISCOUNT";
    unitPrice: number | null;
    percentDiscount: number | null;
  };
  showProduct: boolean;
  productName: string;
  productSalePrice: number;
}) {
  const del = useDeleteProductPrice();
  const finalPrice =
    row.pricingMode === "FIXED"
      ? (row.unitPrice ?? 0)
      : Math.round(
          productSalePrice * (1 - (row.percentDiscount ?? 0) / 100) * 100,
        ) / 100;
  return (
    <TableRow>
      <TableCell
        className={showProduct ? "font-medium" : "text-muted-foreground"}
      >
        {showProduct ? productName : ""}
      </TableCell>
      <TableCell>
        {showProduct ? `R$ ${currencyFormatter(productSalePrice)}` : ""}
      </TableCell>
      <TableCell>{row.minQuantity} un</TableCell>
      <TableCell>
        {row.pricingMode === "FIXED" ? (
          <Badge variant="secondary">Fixo</Badge>
        ) : (
          <Badge variant="outline" className="text-primary">
            <Percent className="mr-1 size-3" />% desconto
          </Badge>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.pricingMode === "FIXED"
          ? `R$ ${currencyFormatter(row.unitPrice ?? 0)}`
          : `${row.percentDiscount ?? 0}%`}
      </TableCell>
      <TableCell className="font-semibold tabular-nums">
        R$ {currencyFormatter(finalPrice)}
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => del.mutate({ id: row.id })}
          disabled={del.isPending}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddTierDialog({ priceListId }: { priceListId: string }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [minQuantity, setMinQuantity] = useState<number>(1);
  const [mode, setMode] = useState<Mode>("FIXED");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [percent, setPercent] = useState<string>("");
  const setPrice = useSetProductPrice();

  // Reusa a listagem de produtos do próprio ERP (cursor de 50 itens já dá).
  const { data: products = [] } = useProducts({ limit: 50, cursor: undefined });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" />
          Adicionar faixa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova faixa de preço</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Produto</FieldLabel>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` — ${p.sku}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>A partir de (unidades)</FieldLabel>
            <Input
              type="number"
              min={1}
              value={minQuantity}
              onChange={(e) => setMinQuantity(Number(e.target.value) || 1)}
            />
          </Field>
          <Field>
            <FieldLabel>Modo</FieldLabel>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Preço fixo (R$)</SelectItem>
                <SelectItem value="PERCENT_DISCOUNT">
                  % de desconto sobre o preço base
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === "FIXED" ? (
            <Field>
              <FieldLabel>Preço unitário (R$)</FieldLabel>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Ex.: 8.50"
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel>% de desconto (0–100)</FieldLabel>
              <Input
                type="number"
                step="0.01"
                min={0.01}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="Ex.: 20"
              />
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            disabled={
              setPrice.isPending ||
              !productId ||
              (mode === "FIXED" ? !unitPrice : !percent)
            }
            onClick={() => {
              setPrice.mutate(
                {
                  priceListId,
                  productId,
                  minQuantity,
                  unitPrice: mode === "FIXED" ? Number(unitPrice) : undefined,
                  percentDiscount:
                    mode === "PERCENT_DISCOUNT" ? Number(percent) : undefined,
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setProductId("");
                    setMinQuantity(1);
                    setUnitPrice("");
                    setPercent("");
                    setMode("FIXED");
                  },
                },
              );
            }}
          >
            {setPrice.isPending && <Spinner />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
