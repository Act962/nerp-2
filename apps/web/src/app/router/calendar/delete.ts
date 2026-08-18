import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveCalendarActor } from "./_access";

export const deleteCalendarEvent = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveCalendarActor(context.org.id, context.user.id);
    if (!actor?.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não pode excluir eventos do calendário",
      });
    }

    // deleteMany com organizationId no where: um `delete` por id só apagaria
    // sem conferir o tenant.
    const { count } = await prisma.calendarEvent.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    return { id: input.id };
  });
