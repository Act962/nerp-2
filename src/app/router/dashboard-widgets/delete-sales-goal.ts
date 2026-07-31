import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

export const deleteDashboardSalesGoal = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover uma meta de vendas do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({ goalId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const goal = await prisma.dashboardSalesGoal.findFirst({
      where: { id: input.goalId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!goal) {
      throw errors.NOT_FOUND({ message: "Meta não encontrada." });
    }

    await prisma.dashboardSalesGoal.delete({ where: { id: goal.id } });
    return { deleted: true as const };
  });
