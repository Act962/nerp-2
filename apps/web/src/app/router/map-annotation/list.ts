import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listMapAnnotation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ floorPlanId: z.string() }))
  .handler(async ({ input, context }) => {
    const annotations = await prisma.mapAnnotation.findMany({
      where: {
        organizationId: context.org.id,
        floorPlanId: input.floorPlanId,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        x: true,
        y: true,
        text: true,
        status: true,
        mapObjectId: true,
      },
    });

    return { annotations };
  });
