import "server-only";

import { planoDaOrganizacao } from "@/features/billing/server/plano-da-organizacao";
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
 *
 * O plano vem de `planoDaOrganizacao` (catálogo em `billing/lib/planos.ts`).
 * Grátis e legado dão zero por ciclo e saem antes de mover a data — o que,
 * no Grátis, faz `starsUsedInCycle` acumular desde a criação: é exatamente o
 * "consumido das 50" que a barra mostra.
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
    select: { starsCycleStart: true },
  });

  if (!org) return { creditou: false, valor: 0 };

  // Já creditou neste mês.
  if (org.starsCycleStart && org.starsCycleStart >= inicioDoMes) {
    return { creditou: false, valor: 0 };
  }

  const { plano } = await planoDaOrganizacao(organizationId);
  const valor = plano.limites.starsPorCiclo;
  if (valor <= 0) return { creditou: false, valor: 0 };

  // Move o ciclo ANTES de creditar, condicionado ao valor antigo. Quem perde a
  // corrida não credita de novo. Se o crédito falhasse depois disto, a
  // organização ficaria um mês sem — por isso o crédito vem logo em seguida e
  // sem `catch` que engula erro.
  //
  // O consumido zera na mesma escrita: ciclo novo, barra do zero.
  const { count } = await prisma.organization.updateMany({
    where: {
      id: organizationId,
      OR: [{ starsCycleStart: null }, { starsCycleStart: { lt: inicioDoMes } }],
    },
    data: { starsCycleStart: inicioDoMes, starsUsedInCycle: 0 },
  });

  if (count === 0) return { creditou: false, valor: 0 };

  await creditar({
    organizationId,
    valor,
    tipo: "PLAN_CREDIT",
    descricao: `Crédito mensal do plano ${plano.nome}`,
  });

  return { creditou: true, valor };
}
