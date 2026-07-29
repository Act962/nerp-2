import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

const createManualMetricInputSchema = z.object({
  label: z.string().min(1, "Informe o rótulo da métrica"),
  value: z.number(),
  unit: z.enum(["currency", "number", "percent"]).default("number"),
});

// Métrica digitada à mão (ex.: "Meta da diretoria: R$ 500.000") — fica
// disponível como fonte de widget pra qualquer membro da org. Criar/editar é
// admin-only, igual ao padrão de metas do ranking; ler é livre (qualquer
// membro precisa ver isso no catálogo de widgets).
export const createDashboardManualMetric = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar métrica manual do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(createManualMetricInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    const metric = await prisma.dashboardManualMetric.create({
      data: {
        organizationId: context.org.id,
        label: input.label.trim(),
        value: input.value,
        unit: input.unit,
        updatedById: member?.id,
      },
    });

    return { id: metric.id };
  });
