import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const reorderMapLayers = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      floorPlanId: z.string(),
      orderedIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id: input.floorPlanId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!floorPlan) {
      throw errors.NOT_FOUND({ message: "Mapa não encontrado" });
    }

    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.mapLayer.updateMany({
          where: {
            id,
            floorPlanId: input.floorPlanId,
            organizationId: context.org.id,
          },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  });
