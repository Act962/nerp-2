import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";
import { eventInputSchema } from "./_schemas";
import { assertTargetsInOrg } from "./_targets";

export const updateCalendarEvent = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(eventInputSchema.extend({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor?.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não pode editar eventos do calendário",
      });
    }

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt < startsAt) {
      throw errors.BAD_REQUEST({
        message: "O fim do evento não pode ser antes do início",
      });
    }

    const targets = await assertTargetsInOrg(
      context.org.id,
      input.storeIds,
      input.supplierIds,
      input.memberIds,
      errors,
    );

    // Substituição dos alvos numa transação: sem ela, uma falha no meio
    // deixaria o evento sem loja nenhuma.
    await prisma.$transaction([
      prisma.calendarEventStore.deleteMany({ where: { eventId: existing.id } }),
      prisma.calendarEventSupplier.deleteMany({
        where: { eventId: existing.id },
      }),
      prisma.calendarEventAssignee.deleteMany({
        where: { eventId: existing.id },
      }),
      prisma.calendarEventStore.createMany({
        data: targets.storeIds.map((storeId) => ({
          organizationId: context.org.id,
          eventId: existing.id,
          storeId,
        })),
      }),
      prisma.calendarEventSupplier.createMany({
        data: targets.supplierIds.map((supplierId) => ({
          organizationId: context.org.id,
          eventId: existing.id,
          supplierId,
        })),
      }),
      prisma.calendarEventAssignee.createMany({
        data: targets.memberIds.map((memberId) => ({
          organizationId: context.org.id,
          eventId: existing.id,
          memberId,
        })),
      }),
      prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          status: input.status,
          visibility: input.visibility,
          color: input.color ?? null,
          startsAt,
          endsAt,
          isAllDay: input.isAllDay,
          location: input.location ?? null,
        },
      }),
    ]);

    return { id: existing.id };
  });
