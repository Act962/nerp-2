import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";
import { eventInputSchema } from "./_schemas";
import { assertTargetsInOrg } from "./_targets";

export const createCalendarEvent = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(eventInputSchema)
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor?.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não pode criar eventos no calendário",
      });
    }

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

    const event = await prisma.calendarEvent.create({
      data: {
        organizationId: context.org.id,
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
        createdById: actor.memberId,
        stores: {
          create: targets.storeIds.map((storeId) => ({
            organizationId: context.org.id,
            storeId,
          })),
        },
        suppliers: {
          create: targets.supplierIds.map((supplierId) => ({
            organizationId: context.org.id,
            supplierId,
          })),
        },
        assignees: {
          create: targets.memberIds.map((memberId) => ({
            organizationId: context.org.id,
            memberId,
          })),
        },
      },
      select: { id: true },
    });

    return { id: event.id };
  });
