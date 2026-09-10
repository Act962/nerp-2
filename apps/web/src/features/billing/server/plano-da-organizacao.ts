import "server-only";

import prisma from "@/lib/db";
import {
  PLANO_GRATIS,
  PLANO_LEGADO,
  type PlanoDef,
  planoPorId,
} from "../lib/planos";

/**
 * A partir de quando uma organização nova nasce no plano Grátis, com limites.
 *
 * Quem foi criado antes disto é `legado`: sem limite de cadastro e sem ★ de
 * plano. É uma constante em código, e não uma coluna, porque a regra é uma
 * data só e não vale a pena uma migration para marcar cada linha — e porque,
 * quando a assinatura pelo Stripe entrar, ela passa na frente desta regra de
 * qualquer jeito.
 */
export const LIMITES_A_PARTIR_DE = new Date("2026-09-10T00:00:00Z");

export type OrigemDoPlano = "assinatura" | "legado" | "gratis";

export interface PlanoDaOrganizacao {
  plano: PlanoDef;
  origem: OrigemDoPlano;
}

/**
 * Qual plano vale para a organização agora.
 *
 * Ordem: assinatura → legado → grátis. A assinatura ainda não existe — vai
 * ser a tabela `subscription` do `@better-auth/stripe`, com
 * `referenceId = organizationId` e `status` em `active`/`trialing`. Quando o
 * plugin entrar, é AQUI que ela é lida: `planoPorId(subscription.plan)`,
 * antes das duas regras abaixo. Nenhum outro ponto do código deve decidir
 * plano por conta própria.
 */
export async function planoDaOrganizacao(
  organizationId: string,
): Promise<PlanoDaOrganizacao> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { createdAt: true },
  });
  if (!org) return { plano: PLANO_GRATIS, origem: "gratis" };

  return resolverPlano({ createdAt: org.createdAt, assinatura: null });
}

/**
 * A regra pura, separada da consulta para ser testável sem banco.
 * `assinatura` é o id do plano assinado, quando houver.
 */
export function resolverPlano(entrada: {
  createdAt: Date;
  assinatura: string | null;
}): PlanoDaOrganizacao {
  if (entrada.assinatura) {
    const assinado = planoPorId(entrada.assinatura);
    if (assinado && !assinado.gratuito) {
      return { plano: assinado, origem: "assinatura" };
    }
  }
  if (entrada.createdAt < LIMITES_A_PARTIR_DE) {
    return { plano: PLANO_LEGADO, origem: "legado" };
  }
  return { plano: PLANO_GRATIS, origem: "gratis" };
}
