import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const bulkDeleteMapObjects = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      floorPlanId: z.string(),
      ids: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.ids.length === 0) return { success: true };

    await prisma.mapObject.deleteMany({
      where: {
        id: { in: input.ids },
        floorPlanId: input.floorPlanId,
        organizationId: context.org.id,
      },
    });

    return { success: true };
  });
