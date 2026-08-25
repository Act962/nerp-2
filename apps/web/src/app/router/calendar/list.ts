import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";
import { buildCalendarWhere, resolveCalendarActor } from "./_access";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  eventListItemSchema,
  noteItemSchema,
} from "./_schemas";

// Eventos + anotações privadas de uma janela de datas. `canManage` sai daqui
// pronto: o servidor já resolveu o membro, então a tela não precisa de um
// segundo roundtrip só para decidir se mostra o botão "Novo evento".
export const listCalendar = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
      types: z.array(z.enum(EVENT_TYPES)).optional(),
      statuses: z.array(z.enum(EVENT_STATUSES)).optional(),
      storeIds: z.array(z.string()).optional(),
      supplierIds: z.array(z.string()).optional(),
      search: z.string().trim().optional(),
    }),
  )
  .output(
    z.object({
      canManage: z.boolean(),
      events: z.array(eventListItemSchema),
      notes: z.array(noteItemSchema),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const from = new Date(input.from);
    const to = new Date(input.to);

    const audience = await buildCalendarWhere({
      organizationId: context.org.id,
      actor,
      from,
      to,
    });

    // Os filtros da tela entram por AND. Dentro do OR da audiência eles
    // AMPLIARIAM o que o promotor vê, em vez de restringir.
    const filters: Prisma.CalendarEventWhereInput[] = [audience];
    if (input.types?.length) filters.push({ type: { in: input.types } });
    if (input.statuses?.length) {
      filters.push({ status: { in: input.statuses } });
    }
    if (input.storeIds?.length) {
      filters.push({ stores: { some: { storeId: { in: input.storeIds } } } });
    }
    if (input.supplierIds?.length) {
      filters.push({
        suppliers: { some: { supplierId: { in: input.supplierIds } } },
      });
    }
    if (input.search) {
      filters.push({
        title: { contains: input.search, mode: "insensitive" },
      });
    }

    const [events, notes] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: { AND: filters },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          visibility: true,
          color: true,
          startsAt: true,
          endsAt: true,
          isAllDay: true,
          location: true,
          _count: {
            select: { stores: true, suppliers: true, assignees: true },
          },
          checklistItems: {
            select: {
              id: true,
              // Só as conclusões DESTE membro: a lista mostra o progresso dele,
              // e a matriz "quem fez o quê" tem procedure própria.
              completions: {
                where: { memberId: actor.memberId },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      }),
      // Consulta separada, sempre travada no próprio membro. Nem o owner lê a
      // anotação de outra pessoa.
      prisma.calendarNote.findMany({
        where: {
          organizationId: context.org.id,
          memberId: actor.memberId,
          startsAt: { lte: to },
          endsAt: { gte: from },
        },
        orderBy: { startsAt: "asc" },
        include: {
          tasks: { orderBy: { position: "asc" } },
        },
      }),
    ]);

    return {
      canManage: actor.canManage,
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        type: event.type,
        status: event.status,
        visibility: event.visibility,
        color: event.color,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        isAllDay: event.isAllDay,
        location: event.location,
        storeCount: event._count.stores,
        supplierCount: event._count.suppliers,
        assigneeCount: event._count.assignees,
        checklistCount: event.checklistItems.length,
        myDoneCount: event.checklistItems.filter(
          (item) => item.completions.length > 0,
        ).length,
      })),
      notes: notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        color: note.color,
        startsAt: note.startsAt.toISOString(),
        endsAt: note.endsAt.toISOString(),
        isAllDay: note.isAllDay,
        tasks: note.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          isDone: task.isDone,
        })),
      })),
    };
  });
