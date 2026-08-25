import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

const updateManualMetricInputSchema = z.object({
  metricId: z.string(),
  label: z.string().min(1).optional(),
  value: z.number().optional(),
  unit: z.enum(["currency", "number", "percent"]).optional(),
});

export const updateDashboardManualMetric = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar uma métrica manual do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(updateManualMetricInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const metric = await prisma.dashboardManualMetric.findFirst({
      where: { id: input.metricId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!metric) {
      throw errors.NOT_FOUND({ message: "Métrica não encontrada." });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    await prisma.dashboardManualMetric.update({
      where: { id: metric.id },
      data: {
        label: input.label?.trim(),
        value: input.value,
        unit: input.unit,
        updatedById: member?.id,
      },
    });

    return { id: metric.id };
  });
