import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listFloorPlan = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ storeId: z.string() }))
  .handler(async ({ input, context }) => {
    const floorPlans = await prisma.floorPlan.findMany({
      where: { organizationId: context.org.id, storeId: input.storeId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        backgroundImageKey: true,
        _count: { select: { objects: true } },
      },
    });

    return {
      floorPlans: floorPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        updatedAt: plan.updatedAt,
        hasBackground: !!plan.backgroundImageKey,
        objectsCount: plan._count.objects,
      })),
    };
  });
