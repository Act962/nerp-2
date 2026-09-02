import "server-only";

import { PLANS } from "@/features/billing/lib/plans";
import prisma from "@/lib/db";
import { creditar } from "./debitar";

/**
 * Crédito mensal que vem junto com o plano.
 *
 * Não tem cron. O crédito é conferido **na hora em que alguém precisa dele**
 * — ao ler o saldo e ao cobrar uma ação —, comparando `starsCycleStart` com o
 * primeiro dia do mês corrente.
 *
 * Por que sem cron: um cron mensal roda para todas as organizações de uma vez,
 * na madrugada, e quando falha ninguém percebe até a loja reclamar que a
 * mensagem não sai. Aqui, quem chega primeiro no mês dispara o próprio
 * crédito, e uma organização que não usou o módulo naquele mês não gera
 * trabalho nenhum.
 *
 * A corrida entre duas mensagens simultâneas na virada do mês é resolvida com
 * um `updateMany` condicionado ao ciclo antigo, no mesmo padrão do débito:
 * quem consegue mover a data credita; o outro vê `count: 0` e segue.
 */
export async function garantirCreditoDoCiclo(
  organizationId: string,
  agora = new Date(),
): Promise<{ creditou: boolean; valor: number }> {
  const inicioDoMes = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
  );

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      starsCycleStart: true,
      tradeSubscription: { select: { plan: true, status: true } },
    },
  });

  if (!org) return { creditou: false, valor: 0 };

  // Já creditou neste mês.
  if (org.starsCycleStart && org.starsCycleStart >= inicioDoMes) {
    return { creditou: false, valor: 0 };
  }

  const assinatura = org.tradeSubscription;
  if (!assinatura) return { creditou: false, valor: 0 };

  // Só ATIVA e CORTESIA creditam. `INADIMPLENTE` mantém acesso aos módulos
  // em carência — mas acesso é uma coisa e crédito pré-pago é outra: continuar
  // dando ★ a quem não pagou é pagar a Meta pela mensagem dele.
  const valendo =
    assinatura.status === "ATIVA" || assinatura.status === "CORTESIA";
  if (!valendo) return { creditou: false, valor: 0 };

  const valor = PLANS[assinatura.plan]?.quotas.starsPerMonth ?? 0;
  if (valor <= 0) return { creditou: false, valor: 0 };

  // Move o ciclo ANTES de creditar, condicionado ao valor antigo. Quem perde a
  // corrida não credita de novo. Se o crédito falhasse depois disto, a
  // organização ficaria um mês sem — por isso o crédito vem logo em seguida e
  // sem `catch` que engula erro.
  const { count } = await prisma.organization.updateMany({
    where: {
      id: organizationId,
      OR: [{ starsCycleStart: null }, { starsCycleStart: { lt: inicioDoMes } }],
    },
    data: { starsCycleStart: inicioDoMes },
  });

  if (count === 0) return { creditou: false, valor: 0 };

  await creditar({
    organizationId,
    valor,
    tipo: "PLAN_CREDIT",
    descricao: `Crédito mensal do plano ${PLANS[assinatura.plan].name}`,
  });

  return { creditou: true, valor };
}
