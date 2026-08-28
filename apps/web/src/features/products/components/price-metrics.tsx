"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  computePriceMetrics,
  salePriceFromMargin,
  salePriceFromMarkup,
  salePriceFromProfit,
} from "@/utils/pricing";
import { useState } from "react";

type Metric = "profit" | "margin" | "markup";

/**
 * Lucro, margem e markup — os três EDITÁVEIS, os três recalculando o PREÇO DE
 * VENDA. O custo é fato da compra; o preço é a decisão, então é ele que cede.
 *
 * As bases ficam escritas embaixo de cada campo de propósito: mostrar só
 * "margem" foi o que permitiu exibir markup com rótulo de margem por muito
 * tempo, e quem precifica pelos dois números trocados erra o preço.
 */
export function PriceMetrics({
  costPrice,
  salePrice,
  onSalePriceChange,
}: {
  costPrice: number;
  salePrice: number;
  /** Ausente = somente leitura. */
  onSalePriceChange?: (salePrice: number) => void;
}) {
  // Enquanto o campo está sendo digitado, o que vale é o texto cru. Sem isso,
  // digitar "33,333" viraria "33,33" no meio da digitação: o valor volta
  // arredondado do preço de venda e o cursor pula.
  const [editing, setEditing] = useState<{
    metric: Metric;
    raw: string;
  } | null>(null);

  const { profit, marginPercent, markupPercent } = computePriceMetrics(
    costPrice,
    salePrice,
  );

  const readOnly = !onSalePriceChange;
  const semCusto = costPrice <= 0;

  const derived: Record<Metric, string> = {
    profit: profit.toFixed(2),
    margin: marginPercent === null ? "" : marginPercent.toFixed(2),
    markup: markupPercent === null ? "" : markupPercent.toFixed(2),
  };

  const value = (metric: Metric) =>
    editing?.metric === metric ? editing.raw : derived[metric];

  const nextSalePrice = (metric: Metric, meta: number): number | null => {
    if (metric === "profit") return salePriceFromProfit(costPrice, meta);
    if (metric === "margin") return salePriceFromMargin(costPrice, meta);
    return salePriceFromMarkup(costPrice, meta);
  };

  const handleChange = (metric: Metric, raw: string) => {
    setEditing({ metric, raw });
    if (!onSalePriceChange) return;
    const meta = Number(raw);
    // Campo vazio ou "-" no meio da digitação: guarda o texto e espera.
    if (raw.trim() === "" || !Number.isFinite(meta)) return;
    const next = nextSalePrice(metric, meta);
    // `null` = meta impossível (margem ≥ 100%, markup sem custo). Não mexe no
    // preço em vez de gravar absurdo.
    if (next !== null) onSalePriceChange(next);
  };

  const metrics: Array<{
    metric: Metric;
    label: string;
    hint: string;
    negative: boolean;
    disabled: boolean;
  }> = [
    {
      metric: "profit",
      label: "Lucro (R$)",
      hint: "Venda − custo",
      negative: profit < 0,
      disabled: readOnly,
    },
    {
      metric: "margin",
      label: "Margem sobre a venda (%)",
      hint: "Lucro ÷ venda",
      negative: marginPercent !== null && marginPercent < 0,
      disabled: readOnly,
    },
    {
      metric: "markup",
      label: "Markup sobre o custo (%)",
      hint: semCusto ? "Informe o custo primeiro" : "Lucro ÷ custo",
      negative: markupPercent !== null && markupPercent < 0,
      disabled: readOnly || semCusto,
    },
  ];

  return (
    <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
      {metrics.map((item) => (
        <div key={item.metric} className="space-y-1.5">
          <Label htmlFor={`metric-${item.metric}`} className="text-xs">
            {item.label}
          </Label>
          <Input
            id={`metric-${item.metric}`}
            type="number"
            step="0.01"
            inputMode="decimal"
            className={cn("tabular-nums", item.negative && "text-destructive")}
            value={value(item.metric)}
            disabled={item.disabled}
            onChange={(event) => handleChange(item.metric, event.target.value)}
            onBlur={() => setEditing(null)}
          />
          <p className="text-xs text-muted-foreground">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}
