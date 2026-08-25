import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { resolveFieldActor } from "../field-map/_access";

export interface RouteActor {
  memberId: string;
  routeId: string;
  /** Liderança pode roteirizar qualquer loja da organização. */
  canSeeAll: boolean;
}

/**
 * Resolve (e cria na primeira vez) a rota do ator.
 *
 * Uma função só para leitura e escrita: se a autorização de ler divergir da de
 * escrever, é porque alguém mudou um lugar e esqueceu o outro.
 */
export async function resolveRoute(
  organizationId: string,
  userId: string,
): Promise<RouteActor | null> {
  const actor = await resolveFieldActor(organizationId, userId);
  if (!actor) return null;

  const route = await prisma.promoterRoute.upsert({
    where: { memberId: actor.memberId },
    create: { organizationId, memberId: actor.memberId },
    update: {},
    select: { id: true },
  });

  return {
    memberId: actor.memberId,
    routeId: route.id,
    canSeeAll: actor.canSeeAll,
  };
}

/**
 * As lojas que este ator pode roteirizar.
 *
 * Existe para a LISTA e a ESCRITA lerem a mesma regra. Duplicar o `where` no
 * `add-stop` e no `routable-stores` produziria a pior falha possível deste
 * módulo: o app oferece um cliente que o servidor recusa depois, e a pessoa em
 * campo leva um "não encontrado" sobre algo que ela está vendo na tela.
 */
export function routableStoreWhere(
  actor: RouteActor,
  organizationId: string,
): Prisma.StoreWhereInput {
  return {
    organizationId,
    ...(actor.canSeeAll
      ? {}
      : { promoterLinks: { some: { memberId: actor.memberId } } }),
  };
}
