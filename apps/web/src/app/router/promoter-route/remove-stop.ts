import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveRoute } from "./_access";

export const removeRouteStop = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ stopId: z.string().min(1) }))
  .output(z.object({ removed: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveRoute(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    // Escopado pela rota E pela organização: o id vem do cliente.
    const stop = await prisma.promoterRouteStop.findFirst({
      where: {
        id: input.stopId,
        routeId: actor.routeId,
        organizationId: context.org.id,
      },
      select: { id: true },
    });
    if (!stop) throw errors.NOT_FOUND({ message: "Parada não encontrada" });

    // Redensifica as posições numa transação: buracos na numeração fariam a
    // reordenação seguinte parecer que perdeu paradas.
    await prisma.$transaction(async (tx) => {
      await tx.promoterRouteStop.delete({ where: { id: stop.id } });
      const rest = await tx.promoterRouteStop.findMany({
        where: { routeId: actor.routeId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      await Promise.all(
        rest.map((item, index) =>
          tx.promoterRouteStop.update({
            where: { id: item.id },
            data: { position: index },
          }),
        ),
      );
    });

    return { removed: true };
  });
