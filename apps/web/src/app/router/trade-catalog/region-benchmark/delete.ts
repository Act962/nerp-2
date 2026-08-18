import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteRegionCostBenchmark = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.regionCostBenchmark.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Benchmark não encontrado" });
    }

    return prisma.regionCostBenchmark.delete({ where: { id: input.id } });
  });
