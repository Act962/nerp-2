import prisma from "@/lib/db";
import { canSeeAllTrails } from "@/lib/permissions";

export interface FieldActor {
  memberId: string;
  userId: string;
  /** Vê o trajeto dos outros. Quem não tem, vê só o próprio. */
  canSeeAll: boolean;
}

export async function resolveFieldActor(
  organizationId: string,
  userId: string,
): Promise<FieldActor | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { id: true, role: true, permissions: true, tradeRole: true },
  });
  if (!member) return null;

  return {
    memberId: member.id,
    userId,
    canSeeAll: canSeeAllTrails(member),
  };
}

export interface VisiblePromoter {
  memberId: string;
  userId: string;
  name: string;
  /** URL absoluta — o `user.image` é gravado assim; ver `promotor/update-profile`. */
  image: string | null;
  /** Último estado da permissão de GPS reportado pelo App Promotor. */
  lastGeoState: string | null;
  lastGeoStateAt: string | null;
}

/**
 * Quem esta pessoa pode ver no mapa — a ÚNICA resposta para isso.
 *
 * Duas coisas não óbvias:
 *
 * 1. `PdvPhoto.createdById` é **`User.id`, não `Member.id`**. A entrada aceita
 *    `memberIds` (escopáveis pela org) e resolve para `userId` aqui dentro.
 *    Aceitar `userId` cru do cliente deixaria sondar ids de outras
 *    organizações — o filtro por org mascararia o vazamento e ainda assim
 *    confirmaria a existência pelo resultado vazio ou não.
 *
 * 2. Para quem não é liderança, devolve o próprio e pronto, **ignorando o que o
 *    cliente pediu**. O filtro da tela estreita, nunca amplia.
 */
export async function resolveVisiblePromoters(params: {
  organizationId: string;
  actor: FieldActor;
  memberIds?: string[];
}): Promise<VisiblePromoter[]> {
  const { organizationId, actor, memberIds } = params;

  const where = actor.canSeeAll
    ? {
        organizationId,
        ...(memberIds?.length ? { id: { in: memberIds } } : {}),
      }
    : { organizationId, id: actor.memberId };

  const members = await prisma.member.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      lastGeoState: true,
      lastGeoStateAt: true,
      user: { select: { name: true, image: true } },
    },
  });

  return members.map((member) => ({
    memberId: member.id,
    userId: member.userId,
    name: member.user.name,
    image: member.user.image ?? null,
    lastGeoState: member.lastGeoState ?? null,
    lastGeoStateAt: member.lastGeoStateAt?.toISOString() ?? null,
  }));
}
