"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDro } from "@/features/financeiro/hooks/use-financeiro";
import type { Periodo } from "@/features/financeiro/lib/periodo";
import { formatCents } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";

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

export function DroTab({ periodo }: { periodo: Periodo }) {
  const { from, to } = periodo;

  const { data, isPending } = useDro(from, to);
  const op = data?.operational;
  const nonOp = data?.nonOperational;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
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
