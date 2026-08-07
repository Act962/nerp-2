import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { canManageCalendar } from "@/lib/permissions";

export interface CalendarActor {
  memberId: string;
  canManage: boolean;
}

/**
 * Resolve o membro logado e se ele gerencia o calendário. Devolve `null` quando
 * a pessoa não é membro da organização — quem chama decide se isso é 403.
 */
export async function resolveCalendarActor(
  organizationId: string,
  userId: string,
): Promise<CalendarActor | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { id: true, role: true, permissions: true, tradeRole: true },
  });
  if (!member) return null;

  return { memberId: member.id, canManage: canManageCalendar(member) };
}

/**
 * Filtro de audiência do calendário — a ÚNICA fonte de "o que esta pessoa
 * enxerga". `list`, `get`, `move` e `toggleChecklistItem` chamam esta função.
 *
 * Reescrever o `OR` à mão em cada uma delas é como uma das cópias diverge e
 * passa a mostrar (ou aceitar escrita em) evento que não devia.
 *
 * O caminho via distribuidor (`PromoterDistributor`) fica DE FORA por decisão,
 * não por esquecimento: aqui visibilidade é disjunção (qualquer vínculo já
 * mostra o evento). Reaproveitar o grafo do distribuidor faria o promotor ver
 * eventos de qualquer loja atendida por qualquer distribuidor que ele
 * representa — largo demais.
 */
export async function buildCalendarWhere(params: {
  organizationId: string;
  actor: CalendarActor;
  from: Date;
  to: Date;
}): Promise<Prisma.CalendarEventWhereInput> {
  const { organizationId, actor, from, to } = params;

  // O evento "toca" a janela: começa antes do fim E termina depois do início.
  // Sem isto, uma campanha que atravessa o mês inteiro sumiria da tela.
  const range: Prisma.CalendarEventWhereInput = {
    organizationId,
    startsAt: { lte: to },
    endsAt: { gte: from },
  };

  if (actor.canManage) return range;

  const [storeLinks, supplierLinks] = await Promise.all([
    prisma.promoterStore.findMany({
      where: { organizationId, memberId: actor.memberId },
      select: { storeId: true },
    }),
    prisma.promoterSupplier.findMany({
      where: { organizationId, memberId: actor.memberId },
      select: { supplierId: true },
    }),
  ]);

  const storeIds = storeLinks.map((link) => link.storeId);
  const supplierIds = supplierLinks.map((link) => link.supplierId);

  return {
    // `organizationId` fica FORA do OR: o Prisma faz AND entre as chaves de
    // topo, então isto vira `org AND janela AND (a OR b OR c)`. Dentro de um
    // ramo do OR, um evento de outra org entraria pelos outros ramos.
    ...range,
    OR: [
      { visibility: "ORG" },
      { createdById: actor.memberId },
      // Escalado pela coordenação vê a ação mesmo sem vínculo com a loja ou a
      // marca — é o ponto de designar alguém.
      { assignees: { some: { memberId: actor.memberId } } },
      ...(storeIds.length > 0
        ? [{ stores: { some: { storeId: { in: storeIds } } } }]
        : []),
      ...(supplierIds.length > 0
        ? [{ suppliers: { some: { supplierId: { in: supplierIds } } } }]
        : []),
    ],
  };
}

/** O evento existe E esta pessoa o enxerga? Usado antes de qualquer escrita. */
export async function assertEventVisible(params: {
  organizationId: string;
  actor: CalendarActor;
  eventId: string;
}): Promise<boolean> {
  const { organizationId, actor, eventId } = params;

  // Janela ampla: aqui a pergunta é de audiência, não de data.
  const where = await buildCalendarWhere({
    organizationId,
    actor,
    from: new Date(0),
    to: new Date("9999-12-31T00:00:00.000Z"),
  });

  const found = await prisma.calendarEvent.findFirst({
    where: { AND: [where, { id: eventId }] },
    select: { id: true },
  });

  return found !== null;
}
