"use client";

import { Check, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaldo } from "@/features/stars/hooks/use-stars";
import { cn } from "@/lib/utils";
import {
  formatarPrecoDoPlano,
  PLANOS,
  type PlanoDef,
  RECURSOS_LIMITADOS,
  ROTULO_DO_RECURSO,
} from "../lib/planos";

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

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PLANOS.map((plano) => (
        <CardDoPlano
          key={plano.id}
          plano={plano}
          atual={plano.id === planoAtual}
        />
      ))}
    </div>
  );
}

function CardDoPlano({ plano, atual }: { plano: PlanoDef; atual: boolean }) {
  const disponivel = plano.gratuito || plano.priceId !== null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        atual && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-lg">{plano.nome}</h3>
          <p className="text-muted-foreground text-sm">{plano.descricao}</p>
        </div>
        {atual ? <Badge>Plano atual</Badge> : null}
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
                ? `${ROTULO_DO_RECURSO[recurso].plural} ilimitados`
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
