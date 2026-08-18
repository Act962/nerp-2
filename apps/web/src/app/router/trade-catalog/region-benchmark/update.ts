import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateRegionCostBenchmark = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      costPerM2: z.number().positive().optional(),
      source: z.string().trim().nullable().optional(),
      year: z.number().int().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    const existing = await prisma.regionCostBenchmark.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Benchmark não encontrado" });
    }

    return prisma.regionCostBenchmark.update({ where: { id }, data });
  });
