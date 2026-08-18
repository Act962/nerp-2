import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listRegionCostBenchmark = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const items = await prisma.regionCostBenchmark.findMany({
      where: { organizationId: context.org.id },
      orderBy: [{ state: "asc" }, { city: "asc" }],
    });

    return {
      items: items.map((item) => ({
        ...item,
        costPerM2: Number(item.costPerM2),
      })),
    };
  });
