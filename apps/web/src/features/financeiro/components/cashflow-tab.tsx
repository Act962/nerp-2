"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCashflow } from "@/features/financeiro/hooks/use-financeiro";
import type { Periodo } from "@/features/financeiro/lib/periodo";
import { formatCents, formatDate } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function CashflowTab({ periodo }: { periodo: Periodo }) {
  const { from, to } = periodo;

  // Dia puro ("YYYY-MM-DD"), como o DRE e o DRO — quem fecha o intervalo no
  // fim do dia é o servidor.
  const { data, isPending } = useCashflow(from, to);

  const chartData =
    data?.days.map((d) => ({
      date: formatDate(d.date, {
        day: "2-digit",
        month: "2-digit",
      }),
      entradas: d.inflow / 100,
      saidas: d.outflow / 100,
    })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCents(data?.totalInflow ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatCents(data?.totalOutflow ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-semibold tabular-nums",
                (data?.net ?? 0) >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {formatCents(data?.net ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo por dia (por vencimento)</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="py-12 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : chartData.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum lançamento no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "currentColor" }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fontSize: 12, fill: "currentColor" }}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) =>
                    v.toLocaleString("pt-BR", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    })
                  }
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : value
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) =>
                    value === "entradas" ? "Entradas" : "Saídas"
                  }
                />
                <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
