import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const createMapLayer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      floorPlanId: z.string(),
      name: z.string().min(1),
      order: z.number().int().optional(),
      color: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: input.floorPlanId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Mapa não encontrado" });
    }

    const layer = await prisma.mapLayer.create({
      data: {
        id: input.id,
        organizationId: context.org.id,
        floorPlanId: input.floorPlanId,
        name: input.name,
        order: input.order ?? 0,
        color: input.color,
      },
      select: { id: true },
    });

    return { id: layer.id };
  });
