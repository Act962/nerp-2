import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { buildCalendarWhere, resolveCalendarActor } from "./_access";
import { EVENT_STATUSES, EVENT_TYPES, EVENT_VISIBILITIES } from "./_schemas";

// Detalhe do evento + checklist com o que ESTE membro já concluiu.
export const getCalendarEvent = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      canManage: z.boolean(),
      event: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        type: z.enum(EVENT_TYPES),
        status: z.enum(EVENT_STATUSES),
        visibility: z.enum(EVENT_VISIBILITIES),
        color: z.string().nullable(),
        startsAt: z.string(),
        endsAt: z.string(),
        isAllDay: z.boolean(),
        location: z.string().nullable(),
        stores: z.array(z.object({ id: z.string(), name: z.string() })),
        suppliers: z.array(z.object({ id: z.string(), name: z.string() })),
        assignees: z.array(z.object({ id: z.string(), name: z.string() })),
        checklistItems: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().nullable(),
            isRequired: z.boolean(),
            position: z.number(),
            // Lojas em que ESTE membro já marcou o item. `null` na lista
            // representa a marcação de um evento sem loja alvo.
            doneStoreIds: z.array(z.string().nullable()),
          }),
        ),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    // Janela ampla de propósito: aqui a pergunta é de audiência, não de data.
    const audience = await buildCalendarWhere({
      organizationId: context.org.id,
      actor,
      from: new Date(0),
      to: new Date("9999-12-31T00:00:00.000Z"),
    });

    const event = await prisma.calendarEvent.findFirst({
      where: { AND: [audience, { id: input.id }] },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        visibility: true,
        color: true,
        startsAt: true,
        endsAt: true,
        isAllDay: true,
        location: true,
        stores: { select: { store: { select: { id: true, name: true } } } },
        suppliers: {
          select: { supplier: { select: { id: true, name: true } } },
        },
        assignees: {
          select: {
            member: {
              select: { id: true, user: { select: { name: true } } },
            },
          },
        },
        checklistItems: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            isRequired: true,
            position: true,
            completions: {
              where: { memberId: actor.memberId },
              select: { storeId: true },
            },
          },
        },
      },
    });

    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    return {
      canManage: actor.canManage,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        type: event.type,
        status: event.status,
        visibility: event.visibility,
        color: event.color,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        isAllDay: event.isAllDay,
        location: event.location,
        stores: event.stores.map((link) => link.store),
        suppliers: event.suppliers.map((link) => link.supplier),
        assignees: event.assignees.map((link) => ({
          id: link.member.id,
          name: link.member.user.name,
        })),
        checklistItems: event.checklistItems.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          isRequired: item.isRequired,
          position: item.position,
          doneStoreIds: item.completions.map((done) => done.storeId),
        })),
      },
    };
  });
