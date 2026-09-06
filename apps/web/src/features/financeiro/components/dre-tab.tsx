"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDre } from "@/features/financeiro/hooks/use-financeiro";
import type { Periodo } from "@/features/financeiro/lib/periodo";
import { formatCents } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";
import { computePriceMetrics, formatPercent } from "@/utils/pricing";

interface DreNode {
  id: string;
  name: string;
  total: number;
  children: DreNode[];
}

function DreRows({
  nodes,
  depth = 0,
  sign,
}: {
  nodes: DreNode[];
  depth?: number;
  sign: 1 | -1;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id} className="flex flex-col">
          <div
            className={cn(
              "flex items-center justify-between border-b py-1.5 text-sm",
              depth === 0 ? "font-medium" : "text-muted-foreground",
            )}
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            <span className="truncate">{node.name}</span>
            <span className="tabular-nums">
              {sign < 0 && node.total > 0 ? "−" : ""}
              {formatCents(node.total)}
            </span>
          </div>
          {node.children.length > 0 && (
            <DreRows nodes={node.children} depth={depth + 1} sign={sign} />
          )}
        </div>
      ))}
    </>
  );
}

function GroupCard({
  title,
  total,
  nodes,
  sign,
  tone,
}: {
  title: string;
  total: number;
  nodes: DreNode[];
  sign: 1 | -1;
  tone: "emerald" | "red";
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <span
          className={cn(
            "text-lg font-semibold tabular-nums",
            tone === "emerald"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {sign < 0 && total > 0 ? "−" : ""}
          {formatCents(total)}
        </span>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Nada no período.
          </div>
        ) : (
          <DreRows nodes={nodes} sign={sign} />
        )}
      </CardContent>
    </Card>
  );
}

function ResultCard({
  label,
  value,
  hint,
  format = formatCents,
}: {
  label: string;
  // `null` = sem base para o cálculo (ver computePriceMetrics); vira "—".
  value: number | null;
  hint?: string;
  format?: (value: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            value === null
              ? "text-muted-foreground"
              : value >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
          )}
        >
          {value === null ? "—" : format(value)}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DreTab({ periodo }: { periodo: Periodo }) {
  const { from, to } = periodo;

  const { data, isPending } = useDre(from, to);

  // Mesma conta do cadastro de produto, agora sobre o período: o resultado
  // bruto é o "lucro", a receita é a "venda" e os custos são o "custo".
  const { marginPercent, markupPercent } = computePriceMetrics(
    data?.cost.total ?? 0,
    data?.revenue.total ?? 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          Por competência (na falta, usa o vencimento). Não inclui cancelados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ResultCard label="Receita" value={data?.revenue.total ?? 0} />
        <ResultCard
          label="Custos + Despesas"
          value={-((data?.cost.total ?? 0) + (data?.expense.total ?? 0))}
        />
        <ResultCard
          label="Resultado bruto"
          value={data?.grossResult ?? 0}
          hint="Receita − custos"
        />
        <ResultCard label="Resultado líquido" value={data?.netResult ?? 0} />
        <ResultCard
          label="Margem sobre a venda"
          value={marginPercent}
          format={formatPercent}
          hint="Resultado bruto ÷ receita"
        />
        <ResultCard
          label="Markup sobre o custo"
          value={markupPercent}
          format={formatPercent}
          hint="Resultado bruto ÷ custos"
        />
      </div>

      {isPending ? (
        <div className="py-12 text-center text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <GroupCard
            title="Receitas"
            total={data?.revenue.total ?? 0}
            nodes={data?.revenue.nodes ?? []}
            sign={1}
            tone="emerald"
          />
          <GroupCard
            title="Custos"
            total={data?.cost.total ?? 0}
            nodes={data?.cost.nodes ?? []}
            sign={-1}
            tone="red"
          />
          <GroupCard
            title="Despesas"
            total={data?.expense.total ?? 0}
            nodes={data?.expense.nodes ?? []}
            sign={-1}
            tone="red"
          />
        </div>
      )}
    </div>
  );
}
