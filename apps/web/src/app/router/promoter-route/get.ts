import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveRoute } from "./_access";
import { pathLength } from "./_optimize";

export const routeStopSchema = z.object({
  id: z.string(),
  position: z.number(),
  kind: z.enum(["STORE", "DIRECTORY"]),
  targetId: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const getMyRoute = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      routeId: z.string(),
      optimizedAt: z.string().nullable(),
      stops: z.array(routeStopSchema),
      totalMeters: z.number(),
    }),
  )
  .handler(async ({ context, errors }) => {
    const actor = await resolveRoute(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const route = await prisma.promoterRoute.findUniqueOrThrow({
      where: { id: actor.routeId },
      select: {
        optimizedAt: true,
        stops: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            storeId: true,
            directoryStoreId: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    const stops = route.stops.flatMap((stop) => {
      // O CHECK do banco garante exatamente um dos dois; o predicado existe
      // porque o TypeScript não sabe disso.
      const targetId = stop.storeId ?? stop.directoryStoreId;
      if (!targetId) return [];
      return [
        {
          id: stop.id,
          position: stop.position,
          kind: (stop.storeId ? "STORE" : "DIRECTORY") as "STORE" | "DIRECTORY",
          targetId,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
      ];
    });

    return {
      routeId: actor.routeId,
      optimizedAt: route.optimizedAt?.toISOString() ?? null,
      stops,
      totalMeters: Math.round(pathLength(stops)),
    };
  });
