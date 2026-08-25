import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";

// Arrastar o evento para outro dia. Preserva a DURAÇÃO — o cliente manda o novo
// início já com a hora original, e aqui só deslocamos o fim pelo mesmo delta.
export const moveCalendarEvent = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), startsAt: z.string().datetime() }))
  .output(
    z.object({ id: z.string(), startsAt: z.string(), endsAt: z.string() }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor?.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não pode mover eventos do calendário",
      });
    }

    const existing = await prisma.calendarEvent.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const duration = existing.endsAt.getTime() - existing.startsAt.getTime();
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + duration);

    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { startsAt, endsAt },
    });

    return {
      id: existing.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  });
