"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDro } from "@/features/financeiro/hooks/use-financeiro";
import { formatCents } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";
import { useState } from "react";

function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

function Line({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: number;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b py-2 text-sm",
        strong && "border-t-2 font-semibold",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong
            ? value >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
            : negative
              ? "text-red-600 dark:text-red-400"
              : undefined,
        )}
      >
        {negative && value > 0 ? "−" : ""}
        {formatCents(value)}
      </span>
    </div>
  );
}

export function DroTab() {
  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);

  const { data, isPending } = useDro(from, to);
  const op = data?.operational;
  const nonOp = data?.nonOperational;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dro-from">De</Label>
          <Input
            id="dro-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dro-to">Até</Label>
          <Input
            id="dro-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Operacional × não-operacional pela marcação da categoria. Por
          competência, sem cancelados.
        </p>
      </div>

      {isPending ? (
        <div className="py-12 text-center text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resultado operacional</CardTitle>
            </CardHeader>
            <CardContent>
              <Line label="Receita operacional" value={op?.revenue ?? 0} />
              <Line label="(−) Custos" value={op?.cost ?? 0} negative />
              <Line label="(−) Despesas" value={op?.expense ?? 0} negative />
              <Line
                label="= Resultado operacional"
                value={op?.result ?? 0}
                strong
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado não-operacional (financeiro)</CardTitle>
            </CardHeader>
            <CardContent>
              <Line label="Receitas financeiras" value={nonOp?.revenue ?? 0} />
              <Line label="(−) Custos" value={nonOp?.cost ?? 0} negative />
              <Line
                label="(−) Despesas financeiras"
                value={nonOp?.expense ?? 0}
                negative
              />
              <Line
                label="= Resultado não-operacional"
                value={nonOp?.result ?? 0}
                strong
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Resultado líquido</CardTitle>
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums",
              (data?.netResult ?? 0) >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCents(data?.netResult ?? 0)}
          </span>
        </CardHeader>
      </Card>
    </div>
  );
}
