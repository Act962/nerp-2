"use client";

import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExtrato, useSaldo } from "../hooks/use-stars";
import { PrecosDasAcoes } from "./precos-das-acoes";
import { Recarregar } from "./recarregar";

const ROTULO_DE_TIPO: Record<string, string> = {
  PLAN_CREDIT: "Crédito do plano",
  TOPUP_PURCHASE: "Recarga",
  APP_CHARGE: "Consumo",
  MANUAL_ADJUST: "Ajuste",
  REFUND: "Estorno",
  WELCOME_BONUS: "Bônus de boas-vindas",
};

export function CreditosContainer() {
  const { data: saldo, isPending } = useSaldo();
  const {
    data: extrato,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExtrato();

  if (isPending || !saldo) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando saldo…
      </div>
    );
  }

  const lancamentos =
    extrato?.pages.flatMap((pagina) => pagina.lancamentos) ?? [];

  // O crédito entra pelo webhook, não pela volta do navegador: quem paga e
  // fecha a aba recebe igual. Por isso "em instantes", e não o saldo novo.
  const voltouDoPagamento =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("recarga");

  return (
    <div className="flex flex-col gap-6">
      {voltouDoPagamento === "ok" ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 text-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Pagamento recebido. Os créditos entram em instantes, assim que o
          Stripe confirmar — pode fechar esta tela.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-6 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Star className="size-8 text-amber-500" />
          <div>
            <p className="font-semibold text-2xl">{saldo.saldo}</p>
            <p className="text-muted-foreground text-xs">Stars disponíveis</p>
          </div>
        </div>

        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>
              Plano <strong>{saldo.plano.nome}</strong>
              {saldo.limite > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {saldo.consumido} de {saldo.limite} ★ usadas
                </span>
              ) : null}
            </span>
            {saldo.limite > 0 ? (
              <span className="text-muted-foreground tabular-nums">
                {saldo.percentual}%
              </span>
            ) : null}
          </div>
          {saldo.limite > 0 ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  saldo.nivel === "ok" ? "bg-primary" : "",
                  saldo.nivel === "atencao" ? "bg-amber-500" : "",
                  saldo.nivel === "critico" || saldo.nivel === "esgotado"
                    ? "bg-destructive"
                    : "",
                )}
                style={{ width: `${saldo.percentual}%` }}
              />
            </div>
          ) : null}
          {saldo.usoExtra > 0 ? (
            <p className="text-muted-foreground text-xs">
              Uso extra: {saldo.usoExtra} ★ além do plano, pagas com Stars
              avulsas.
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Astro: <strong>{saldo.precos.astroPor1k} ★</strong> a cada 1.000
            tokens
            {saldo.cobrancaAtiva ? (
              <>
                {" "}
                · Mensagem: <strong>{saldo.precos.mensagem} ★</strong> ·
                Campanha: <strong>{saldo.precos.campanha} ★</strong> por
                destinatário
                {saldo.mensagensRestantes !== null
                  ? ` (cerca de ${saldo.mensagensRestantes} mensagens)`
                  : ""}
              </>
            ) : (
              " · Mensagens do WhatsApp ainda sem cobrança"
            )}
          </p>
        </div>

        <div className="ms-auto">
          <Recarregar />
        </div>
      </div>

      <PrecosDasAcoes />

      <section className="space-y-2">
        <h2 className="font-medium text-sm">Extrato</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Movimento</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((linha) => (
                <tr key={linha.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {new Date(linha.quando).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="block">{linha.descricao}</span>
                    <span className="text-muted-foreground text-xs">
                      {ROTULO_DE_TIPO[linha.tipo] ?? linha.tipo}
                    </span>
                  </td>
                  <td
                    className={
                      linha.valor < 0
                        ? "px-3 py-2 text-right text-destructive"
                        : "px-3 py-2 text-right text-emerald-600 dark:text-emerald-500"
                    }
                  >
                    {linha.valor > 0 ? "+" : ""}
                    {linha.valor}
                  </td>
                  {/* O saldo resultante fica gravado em cada linha: é o que
                      permite auditar sem reprocessar a soma inteira. */}
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {linha.saldoDepois}
                  </td>
                </tr>
              ))}
              {lancamentos.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Nenhum movimento ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Carregar mais
          </Button>
        ) : null}
      </section>
    </div>
  );
}
