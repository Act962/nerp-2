"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCurvaAbc,
  useRelatorioDeVendas,
} from "@/features/financeiro/hooks/use-financeiro";
import type { Periodo } from "@/features/financeiro/lib/periodo";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency-formatter";

/**
 * Relatório de vendas: quanto entrou, ticket médio e a curva ABC dos produtos.
 *
 * **Aqui os valores estão em REAIS**, e não em centavos como no resto do
 * financeiro. A origem é `Sale.total`, que é `Decimal` em reais — o restante
 * das abas lê `PaymentEntry.amount`, que é `Int` em centavos. Por isso esta
 * aba formata com `formatBRL` e não com `formatCents`: trocar um pelo outro
 * mostraria cem vezes o valor certo, e o número pareceria plausível.
 */

const GRANULARIDADES = [
  { valor: "dia" as const, rotulo: "Por dia" },
  { valor: "mes" as const, rotulo: "Por mês" },
];

const CRITERIOS = [
  { valor: "valor" as const, rotulo: "Por valor" },
  { valor: "volume" as const, rotulo: "Por volume" },
];

const CORES_DA_CLASSE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  B: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  C: "bg-muted text-muted-foreground",
};

export function VendasTab({ periodo }: { periodo: Periodo }) {
  const [granularidade, setGranularidade] = useState<"dia" | "mes">("dia");
  const [criterio, setCriterio] = useState<"valor" | "volume">("valor");

  const { data, isPending } = useRelatorioDeVendas(
    periodo.from,
    periodo.to,
    granularidade,
  );
  const { data: curva, isPending: carregandoCurva } = useCurvaAbc(
    periodo.from,
    periodo.to,
    criterio,
  );

  const serie = (data?.serie ?? []).map((ponto) => ({
    ...ponto,
    rotulo: rotuloDoBalde(ponto.inicio, granularidade),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero
          rotulo="Total vendido"
          valor={data ? formatBRL(data.resumo.total) : undefined}
          carregando={isPending}
        />
        <Numero
          rotulo="Vendas"
          valor={data ? String(data.resumo.vendas) : undefined}
          carregando={isPending}
        />
        <Numero
          rotulo="Ticket médio"
          valor={data ? formatBRL(data.resumo.ticketMedio) : undefined}
          carregando={isPending}
          destaque
        />
        <Numero
          rotulo="Descontos"
          valor={data ? formatBRL(data.resumo.descontos) : undefined}
          carregando={isPending}
        />
        <Numero
          rotulo="Itens vendidos"
          valor={data ? formatarNumero(data.resumo.itens) : undefined}
          carregando={isPending}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Vendas no período</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total e ticket médio de cada{" "}
              {granularidade === "dia" ? "dia" : "mês"}.
            </p>
          </div>
          <Alternador
            opcoes={GRANULARIDADES}
            valor={granularidade}
            onChange={setGranularidade}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : serie.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma venda no período.
            </p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="rotulo" tickLine={false} fontSize={12} />
                    <YAxis
                      tickFormatter={(v: number) => formatBRL(v)}
                      width={90}
                      fontSize={12}
                    />
                    {/* Uma barra só, então o formatter não precisa saber de
                        qual série veio — e a assinatura do recharts para o
                        nome mudou de versão para versão. Mesmo desenho do
                        gráfico do Dashboard, para as duas telas combinarem. */}
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(valor) =>
                        typeof valor === "number" ? formatBRL(valor) : valor
                      }
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--color-primary)"
                      radius={4}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* A tabela não é redundante com o gráfico: dela sai o número
                  exato que vai para a planilha, e nela cabe o ticket médio,
                  que numa segunda barra ficaria rasteira ao lado do total. */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {granularidade === "dia" ? "Dia" : "Mês"}
                      </TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ticket médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serie.map((ponto) => (
                      <TableRow key={ponto.inicio}>
                        <TableCell>{ponto.rotulo}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {ponto.vendas}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(ponto.total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(ponto.ticketMedio)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-64 flex-1">
            <CardTitle className="text-base">Curva ABC dos produtos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Classe <strong>A</strong> vai até 80% do acumulado,{" "}
              <strong>B</strong> até 95%, <strong>C</strong> o resto. Por valor
              manda na negociação; por volume, no estoque — e quase nunca é a
              mesma lista.
            </p>
          </div>
          <Alternador
            opcoes={CRITERIOS}
            valor={criterio}
            onChange={setCriterio}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {carregandoCurva ? (
            <Skeleton className="h-64 w-full" />
          ) : !curva || curva.itens.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum produto vendido no período.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {curva.classes.map((classe) => (
                  <div
                    key={classe.classe}
                    className="flex flex-col gap-1 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded font-semibold text-xs",
                          CORES_DA_CLASSE[classe.classe],
                        )}
                      >
                        {classe.classe}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {classe.itens} produto(s)
                      </span>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {porcentagem(classe.fatia)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {criterio === "valor"
                        ? formatBRL(classe.valor)
                        : `${formatarNumero(classe.volume)} unidades`}
                    </p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Fatia</TableHead>
                      <TableHead className="text-right">Acumulado</TableHead>
                      <TableHead className="w-10 text-center">Classe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {curva.itens.map((item) => (
                      <TableRow key={item.produtoId}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {item.posicao}
                        </TableCell>
                        <TableCell>
                          <span className="block">{item.nome}</span>
                          {item.sku && (
                            <span className="text-xs text-muted-foreground">
                              {item.sku}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(item.valor)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarNumero(item.volume)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {porcentagem(item.fatia)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {porcentagem(item.acumulado)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={CORES_DA_CLASSE[item.classe]}
                          >
                            {item.classe}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  carregando,
  destaque,
}: {
  rotulo: string;
  valor?: string;
  carregando: boolean;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? "border-primary/40" : undefined}>
      <CardContent className="p-4">
        {carregando ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-xl font-semibold leading-none tabular-nums">
            {valor ?? "—"}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
      </CardContent>
    </Card>
  );
}

function Alternador<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (valor: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border p-1">
      {opcoes.map((opcao) => (
        <Button
          key={opcao.valor}
          type="button"
          size="sm"
          variant={opcao.valor === valor ? "default" : "ghost"}
          onClick={() => onChange(opcao.valor)}
        >
          {opcao.rotulo}
        </Button>
      ))}
    </div>
  );
}

/**
 * O rótulo do balde.
 *
 * O servidor devolve o início de cada balde já no fuso da loja, mas em ISO com
 * "Z" — formatar em fuso local voltaria um dia em quem estiver a oeste. Por
 * isso a formatação é forçada em UTC, do mesmo jeito que `formatDate` faz com
 * os vencimentos.
 */
function rotuloDoBalde(iso: string, granularidade: "dia" | "mes"): string {
  return new Date(iso).toLocaleDateString(
    "pt-BR",
    granularidade === "dia"
      ? { day: "2-digit", month: "2-digit", timeZone: "UTC" }
      : { month: "short", year: "2-digit", timeZone: "UTC" },
  );
}

function porcentagem(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatarNumero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
