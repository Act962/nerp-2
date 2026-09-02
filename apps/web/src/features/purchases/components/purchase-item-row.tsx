"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { AlertTriangle, X } from "lucide-react";
import type { EditorItem } from "../lib/editor-item";
import { suggestSalePrice } from "../lib/price-suggestion";
import { lineTotal, unitCost } from "../lib/purchase-totals";

export const ITEM_GRID =
  "grid grid-cols-[minmax(0,1fr)_84px_104px_96px_104px_176px_32px] items-center gap-3";

export function PurchaseItemRow({
  item,
  readOnly,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  readOnly: boolean;
  onChange: (patch: Partial<EditorItem>) => void;
  onRemove: () => void;
}) {
  const total = lineTotal(item);
  const custo = unitCost(item);
  const sugestao = suggestSalePrice({
    previousCost: item.product.costPrice,
    previousSalePrice: item.product.salePrice,
    newCost: custo,
  });
  const aceito = item.newSalePrice !== null;
  const abaixoDoCusto =
    aceito && item.newSalePrice !== null
      ? item.newSalePrice < custo
      : item.product.salePrice < custo;

  return (
    <li className={cn(ITEM_GRID, "py-2.5")}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.code ?? "sem código"} · {item.unit}
          {item.product.trackStock
            ? ` · estoque ${item.product.currentStock}`
            : " · sem controle de estoque"}
        </p>
      </div>

      <Input
        type="number"
        min={0}
        step="0.001"
        aria-label={`Quantidade de ${item.name}`}
        value={item.quantity}
        disabled={readOnly}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) =>
          onChange({ quantity: Number(event.target.value) || 0 })
        }
        className="h-8 text-center tabular-nums"
      />

      <Input
        type="number"
        min={0}
        step="0.01"
        aria-label={`Preço de compra de ${item.name}`}
        value={item.unitPrice}
        disabled={readOnly}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) =>
          onChange({ unitPrice: Number(event.target.value) || 0 })
        }
        className="h-8 text-right tabular-nums"
      />

      <Input
        type="number"
        min={0}
        step="0.01"
        aria-label={`Desconto da linha de ${item.name}`}
        value={item.discount}
        disabled={readOnly}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) =>
          onChange({ discount: Number(event.target.value) || 0 })
        }
        className="h-8 text-right tabular-nums"
      />

      <div className="text-right text-sm tabular-nums">
        <p>{currencyFormatter(total)}</p>
        <p className="text-xs text-muted-foreground">
          {currencyFormatter(custo)} /{item.unit}
        </p>
      </div>

      {/* Sugestão de preço de venda: só aparece quando há o que sugerir, e
          nunca se aplica sozinha — quem marca é o operador. */}
      <div className="min-w-0 text-xs">
        {sugestao === null ? (
          <span className="text-muted-foreground">
            {custo > 0 && item.product.costPrice === 0
              ? "sem custo anterior"
              : "preço mantido"}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`sugestao-${item.lineId}`}
              checked={aceito}
              disabled={readOnly}
              onCheckedChange={(marcado) =>
                onChange({ newSalePrice: marcado === true ? sugestao : null })
              }
              aria-label={`Aplicar preço sugerido para ${item.name}`}
            />
            <label
              htmlFor={`sugestao-${item.lineId}`}
              className="min-w-0 cursor-pointer"
            >
              <span className="block truncate tabular-nums">
                {currencyFormatter(item.product.salePrice)} →{" "}
                <strong>
                  {currencyFormatter(item.newSalePrice ?? sugestao)}
                </strong>
              </span>
              {abaixoDoCusto && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="size-3" />
                  abaixo do custo
                </span>
              )}
            </label>
          </div>
        )}
      </div>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={readOnly}
        onClick={onRemove}
        aria-label={`Remover ${item.name}`}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}
