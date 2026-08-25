import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Leitura livre pra qualquer membro (precisa aparecer no catálogo de
// widgets) — só criar/editar/apagar é admin-only.
export const listDashboardManualMetrics = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar métricas manuais do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({}))
  .handler(async ({ context }) => {
    const metrics = await prisma.dashboardManualMetric.findMany({
      where: { organizationId: context.org.id },
      orderBy: { label: "asc" },
      include: { updatedBy: { select: { user: { select: { name: true } } } } },
    });

    return {
      metrics: metrics.map((metric) => ({
        id: metric.id,
        label: metric.label,
        value: Number(metric.value),
        unit: metric.unit,
        updatedByName: metric.updatedBy?.user.name ?? null,
        updatedAt: metric.updatedAt.toISOString(),
      })),
    };
  });
