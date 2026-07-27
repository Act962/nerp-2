import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listPlanograms = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const planograms = await prisma.planogram.findMany({
      where: { organizationId: context.org.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        isActive: true,
        releaseAt: true,
        currentVersion: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        _count: { select: { fixtures: true, items: true } },
      },
    });

    return {
      planograms: planograms.map((planogram) => ({
        id: planogram.id,
        name: planogram.name,
        code: planogram.code,
        status: planogram.status,
        isActive: planogram.isActive,
        releaseAt: planogram.releaseAt?.toISOString() ?? null,
        currentVersion: planogram.currentVersion,
        updatedAt: planogram.updatedAt.toISOString(),
        categoryName: planogram.category?.name ?? null,
        fixturesCount: planogram._count.fixtures,
        itemsCount: planogram._count.items,
      })),
    };
  });
