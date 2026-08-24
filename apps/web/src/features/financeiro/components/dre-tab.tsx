"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDre } from "@/features/financeiro/hooks/use-financeiro";
import { formatCents } from "@/features/financeiro/lib/money";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DreNode {
  id: string;
  name: string;
  total: number;
  children: DreNode[];
}

function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
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

function ResultCard({ label, value }: { label: string; value: number }) {
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
            value >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {formatCents(value)}
        </div>
      </CardContent>
    </Card>
  );
}

export function DreTab() {
  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);

  const { data, isPending } = useDre(from, to);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dre-from">De</Label>
          <Input
            id="dre-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dre-to">Até</Label>
          <Input
            id="dre-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Por competência (na falta, usa o vencimento). Não inclui cancelados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard label="Receita" value={data?.revenue.total ?? 0} />
        <ResultCard
          label="Custos + Despesas"
          value={-((data?.cost.total ?? 0) + (data?.expense.total ?? 0))}
        />
        <ResultCard label="Resultado bruto" value={data?.grossResult ?? 0} />
        <ResultCard label="Resultado líquido" value={data?.netResult ?? 0} />
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
