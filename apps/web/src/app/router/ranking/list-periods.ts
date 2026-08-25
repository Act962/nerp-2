import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { periodTypeSchema } from "./_schemas";

export const listSalesGoalPeriods = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar períodos de meta importados",
    tags: ["ranking"],
  })
  .input(z.object({ periodType: periodTypeSchema.optional() }).optional())
  .handler(async ({ input, context }) => {
    return prisma.salesGoalPeriod.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.periodType ? { periodType: input.periodType } : {}),
      },
      orderBy: { periodStart: "desc" },
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        label: true,
      },
    });
  });
