"use client";

import { Check, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOLUCAO_IDS } from "@/features/onboarding/lib/solucoes";
import { useSaldo } from "@/features/stars/hooks/use-stars";
import { cn } from "@/lib/utils";
import { usePrecosAvulsos } from "../hooks/use-precos-avulsos";
import {
  type Comparativo,
  compararComAvulso,
  economiaPercentual,
} from "../lib/comparativo";
import {
  formatarPrecoDoPlano,
  ilimitado,
  PLANO_EM_DESTAQUE,
  PLANOS,
  type PlanoDef,
  precoAnualCentavos,
  RECURSOS_LIMITADOS,
  ROTULO_DO_RECURSO,
} from "../lib/planos";

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/**
 * Os planos da organização, direto do catálogo em código.
 *
 * Plano sem `priceId` ainda não existe no Stripe: aparece como "em breve",
 * com o botão desligado. Quando o `@better-auth/stripe` entrar, o botão passa
 * a chamar `authClient.subscription.upgrade({ plan: plano.id, referenceId:
 * organizationId, customerType: "organization" })` — nada mais aqui muda.
 */
export function Planos() {
  const { data: saldo } = useSaldo();
  const planoAtual = saldo?.plano.id ?? null;

  /*
    A faixa de preço avulso, para o comparativo. Enquanto a tabela não estiver
    cadastrada em `/site/precos`, nenhum número aparece — preço inventado num
    argumento de venda vira promessa comercial.
  */
  const { data: avulsos } = usePrecosAvulsos();
  const comparativo = compararComAvulso(avulsos, [...SOLUCAO_IDS]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border bg-muted/40 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />A primeira IA que resolve
          dentro da ferramenta
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          O Astro não é um chat ao lado do sistema: ele lê a sua operação, cria
          catálogo, monta campanha e marca ação no calendário — sempre com a sua
          confirmação. Você paga o que usa, em ★, e o plano já vem com uma cota
          todo mês.
        </p>
        {comparativo.disponivel ? (
          <p className="mt-3 text-sm">
            Contratando as {comparativo.ferramentas} ferramentas separadas,
            daria{" "}
            <strong>
              {MOEDA.format(comparativo.minCents / 100)} a{" "}
              {MOEDA.format(comparativo.maxCents / 100)}
            </strong>{" "}
            por mês.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANOS.map((plano) => (
          <CardDoPlano
            key={plano.id}
            plano={plano}
            atual={plano.id === planoAtual}
            comparativo={comparativo}
          />
        ))}
      </div>
    </div>
  );
}

function CardDoPlano({
  plano,
  atual,
  comparativo,
}: {
  plano: PlanoDef;
  atual: boolean;
  comparativo: Comparativo;
}) {
  const disponivel = plano.gratuito || plano.priceId !== null;
  const anual = precoAnualCentavos(plano);
  const economia = economiaPercentual(comparativo, plano.precoCentavos);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        atual && "border-primary ring-1 ring-primary",
        !atual && plano.id === PLANO_EM_DESTAQUE && "border-primary/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-lg">{plano.nome}</h3>
          <p className="text-muted-foreground text-sm">{plano.descricao}</p>
        </div>
        {atual ? (
          <Badge>Plano atual</Badge>
        ) : plano.id === PLANO_EM_DESTAQUE ? (
          <Badge variant="secondary">Mais popular</Badge>
        ) : null}
      </div>

      <p className="font-bold text-2xl">
        {formatarPrecoDoPlano(plano.precoCentavos)}
        {plano.precoCentavos ? (
          <span className="font-normal text-muted-foreground text-sm">
            {" "}
            /mês
          </span>
        ) : null}
      </p>

      {anual ? (
        <p className="-mt-3 text-muted-foreground text-xs">
          ou {MOEDA.format(anual / 100)} por ano — dois meses sem pagar
        </p>
      ) : null}

      {economia !== null ? (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <strong>{economia}% mais barato</strong> que contratar as ferramentas
          separadas.
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5 text-sm">
        <li className="flex items-center gap-2">
          <Star className="size-4 text-amber-500" />
          {plano.limites.starsPorCiclo > 0
            ? `${plano.limites.starsPorCiclo} ★ por mês`
            : plano.starsBoasVindas > 0
              ? `${plano.starsBoasVindas} ★ de boas-vindas`
              : "★ só avulsas"}
        </li>
        {RECURSOS_LIMITADOS.map((recurso) => {
          const limite = plano.limites[recurso];
          return (
            <li key={recurso} className="flex items-center gap-2">
              <Check className="size-4 text-muted-foreground" />
              {limite === null
                ? ilimitado(recurso)
                : `até ${limite} ${
                    limite === 1
                      ? ROTULO_DO_RECURSO[recurso].singular
                      : ROTULO_DO_RECURSO[recurso].plural
                  }`}
            </li>
          );
        })}
      </ul>

      <div className="mt-auto">
        {atual ? (
          <Button variant="outline" className="w-full" disabled>
            Você está aqui
          </Button>
        ) : (
          <Button className="w-full" disabled={!disponivel}>
            {disponivel ? "Escolher" : "Em breve"}
          </Button>
        )}
      </div>
    </div>
  );
}
