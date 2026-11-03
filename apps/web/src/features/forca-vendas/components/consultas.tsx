"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useExtratoFlexFv, useTitulosFv } from "../hooks/use-forca-vendas";
import { formatarData, formatarDataHora, formatBRL } from "../lib/formatar";
import { FvPagina, Linha, Secao, Vazio } from "./fv-pagina";

function Titulos() {
  const { data: titulos, isPending } = useTitulosFv();
  if (isPending) return <Skeleton className="h-40" />;
  if (!titulos || titulos.length === 0) {
    return <Vazio>Nenhum título em aberto na sua carteira.</Vazio>;
  }
  const vencidos = titulos.filter((titulo) => titulo.vencido);
  const totalVencido = vencidos.reduce(
    (soma, titulo) => soma + titulo.valor - titulo.valorPago,
    0,
  );
  const totalAberto = titulos.reduce(
    (soma, titulo) => soma + titulo.valor - titulo.valorPago,
    0,
  );
  return (
    <div className="flex flex-col gap-3">
      <Secao titulo="Carteira">
        <Linha rotulo="Em aberto" valor={formatBRL(totalAberto)} />
        <Linha
          rotulo={`Vencido (${vencidos.length})`}
          valor={formatBRL(totalVencido)}
          destaque={totalVencido > 0 ? "erro" : "ok"}
        />
      </Secao>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {titulos.map((titulo) => (
          <li key={titulo.id}>
            <Link
              href={`/forca-de-vendas/clientes/${titulo.customerId}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {titulo.cliente}
                </span>
                <span
                  className={cn(
                    "block text-xs",
                    titulo.vencido
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {titulo.vencido ? "Venceu" : "Vence"}{" "}
                  {formatarData(titulo.vencimento)}
                  {titulo.numeroDaVenda
                    ? ` · venda #${titulo.numeroDaVenda}`
                    : ""}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {formatBRL(titulo.valor - titulo.valorPago)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TIPO_LANCAMENTO: Record<string, string> = {
  PEDIDO: "Pedido",
  ESTORNO: "Estorno",
  AJUSTE: "Ajuste do gestor",
};

function ExtratoFlex() {
  const { data, isPending } = useExtratoFlexFv();
  if (isPending || !data) return <Skeleton className="h-40" />;
  return (
    <div className="flex flex-col gap-3">
      <Secao titulo="Saldo flex">
        <p className="text-2xl font-bold tabular-nums">
          {formatBRL(data.saldo)}
        </p>
        <p className="text-xs text-muted-foreground">
          Vender acima da tabela credita; desconto além do livre debita. O
          lançamento acontece quando o pedido é faturado.
        </p>
      </Secao>
      {data.lancamentos.length === 0 ? (
        <Vazio>Nenhum lançamento ainda.</Vazio>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {data.lancamentos.map((lancamento) => (
            <li
              key={lancamento.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {lancamento.descricao}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {TIPO_LANCAMENTO[lancamento.tipo] ?? lancamento.tipo} ·{" "}
                  {formatarDataHora(lancamento.data)}
                </span>
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  lancamento.valor < 0
                    ? "text-destructive"
                    : "text-emerald-600",
                )}
              >
                {lancamento.valor > 0 ? "+" : ""}
                {formatBRL(lancamento.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TelaDeConsultas() {
  return (
    <FvPagina titulo="Consultas">
      <Tabs defaultValue="titulos">
        <TabsList className="w-full">
          <TabsTrigger value="titulos" className="flex-1">
            Títulos
          </TabsTrigger>
          <TabsTrigger value="flex" className="flex-1">
            Saldo flex
          </TabsTrigger>
        </TabsList>
        <TabsContent value="titulos" className="mt-3">
          <Titulos />
        </TabsContent>
        <TabsContent value="flex" className="mt-3">
          <ExtratoFlex />
        </TabsContent>
      </Tabs>
    </FvPagina>
  );
}
