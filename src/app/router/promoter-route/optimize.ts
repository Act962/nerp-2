import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveRoute } from "./_access";
import { optimizeRoute as computeOrder } from "./_optimize";

/**
 * Sugere e PERSISTE a melhor ordem.
 *
 * Persiste porque prever-e-confirmar seria um modelo mental pior aqui: o desfazer
 * é arrastar de volta, que a lista já permite.
 */
export const optimizeRoute = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      /** Posição atual de quem pediu, quando o navegador concede. */
      startLatitude: z.number().min(-90).max(90).optional(),
      startLongitude: z.number().min(-180).max(180).optional(),
    }),
  )
  .output(
    z.object({
      beforeMeters: z.number(),
      afterMeters: z.number(),
      count: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveRoute(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const stops = await prisma.promoterRouteStop.findMany({
      where: { routeId: actor.routeId, organizationId: context.org.id },
      orderBy: { position: "asc" },
      select: { id: true, latitude: true, longitude: true },
    });

    if (stops.length < 3) {
      throw errors.BAD_REQUEST({
        message: "Com menos de três paradas não há ordem melhor a sugerir",
      });
    }

    const start =
      input.startLatitude !== undefined && input.startLongitude !== undefined
        ? { latitude: input.startLatitude, longitude: input.startLongitude }
        : undefined;

    const { order, beforeMeters, afterMeters } = computeOrder(stops, start);

    await prisma.$transaction([
      ...order.map((stop, index) =>
        prisma.promoterRouteStop.update({
          where: { id: stop.id },
          data: { position: index },
        }),
      ),
      prisma.promoterRoute.update({
        where: { id: actor.routeId },
        data: { optimizedAt: new Date() },
      }),
    ]);

    return {
      beforeMeters: Math.round(beforeMeters),
      afterMeters: Math.round(afterMeters),
      count: order.length,
    };
  });
