"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/features/financeiro/hooks/use-financeiro";
import { formatCents } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  CalendarClockIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
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

const MONTH_LABELS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function monthLabel(month: string): string {
  const [, m] = month.split("-");
  return MONTH_LABELS[Number(m) - 1] ?? month;
}

interface KpiProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent?: "positive" | "negative" | "neutral";
  hint?: string;
}

function Kpi({ title, value, icon, accent = "neutral", hint }: KpiProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span
          className={cn(
            "text-muted-foreground",
            accent === "positive" && "text-emerald-500",
            accent === "negative" && "text-red-500",
          )}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            accent === "positive" && "text-emerald-600 dark:text-emerald-400",
            accent === "negative" && "text-red-600 dark:text-red-400",
          )}
        >
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardTab() {
  const { data, isPending } = useDashboard();

  if (isPending || !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Carregando indicadores...
      </div>
    );
  }

  const chartData = data.monthly.map((m) => ({
    month: monthLabel(m.month),
    receita: m.receita / 100,
    despesa: m.despesa / 100,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="A receber"
          value={formatCents(data.receberPendente)}
          icon={<ArrowUpCircleIcon className="size-5" />}
          accent="positive"
          hint={`Vencido: ${formatCents(data.vencidoReceber)}`}
        />
        <Kpi
          title="A pagar"
          value={formatCents(data.pagarPendente)}
          icon={<ArrowDownCircleIcon className="size-5" />}
          accent="negative"
          hint={`Vencido: ${formatCents(data.vencidoPagar)}`}
        />
        <Kpi
          title="Recebido no mês"
          value={formatCents(data.recebidoMes)}
          icon={<TrendingUpIcon className="size-5" />}
          accent="positive"
        />
        <Kpi
          title="Pago no mês"
          value={formatCents(data.pagoMes)}
          icon={<TrendingDownIcon className="size-5" />}
          accent="negative"
        />
        <Kpi
          title="Saldo em contas"
          value={formatCents(data.saldoContas)}
          icon={<WalletIcon className="size-5" />}
        />
        <Kpi
          title="Próximos 7 dias"
          value={formatCents(data.proximos7.valor)}
          icon={<CalendarClockIcon className="size-5" />}
          hint={`${data.proximos7.count} lançamento(s) a vencer`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receita x Despesa (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
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
                dataKey="month"
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
                  value === "receita" ? "Receita" : "Despesa"
                }
              />
              <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
