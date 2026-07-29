import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

// Apagar a métrica NÃO apaga os widgets que a usam em outros dashboards —
// dataSourceKey é uma string solta ("manual.<id>"), sem FK, de propósito
// (cascatear apagaria widgets de gente que nem sabe que a métrica sumiu). O
// widget órfão vira um card "fonte removida" (resolveValues devolve null pra
// essa key) em vez de quebrar.
export const deleteDashboardManualMetric = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover uma métrica manual do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({ metricId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const metric = await prisma.dashboardManualMetric.findFirst({
      where: { id: input.metricId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!metric) {
      throw errors.NOT_FOUND({ message: "Métrica não encontrada." });
    }

    await prisma.dashboardManualMetric.delete({ where: { id: metric.id } });
    return { deleted: true as const };
  });
