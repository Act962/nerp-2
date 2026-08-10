"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCashflow } from "@/features/financeiro/hooks/use-financeiro";
import { formatCents, formatDate } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";
import { useState } from "react";
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

function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

export function CashflowTab() {
  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);

  const { data, isPending } = useCashflow(
    from ? new Date(from).toISOString() : "",
    to ? new Date(to).toISOString() : "",
  );

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
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cf-from">De</Label>
          <Input
            id="cf-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cf-to">Até</Label>
          <Input
            id="cf-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

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
