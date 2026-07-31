import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

const updateSalesGoalInputSchema = z.object({
  goalId: z.string(),
  label: z.string().min(1).optional(),
  value: z.number().optional(),
});

// Só rótulo e valor são editáveis — escopo/código/período definem a
// identidade da meta (mudar isso é apagar e criar de novo).
export const updateDashboardSalesGoal = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar uma meta de vendas do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(updateSalesGoalInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const goal = await prisma.dashboardSalesGoal.findFirst({
      where: { id: input.goalId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!goal) {
      throw errors.NOT_FOUND({ message: "Meta não encontrada." });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    await prisma.dashboardSalesGoal.update({
      where: { id: goal.id },
      data: {
        label: input.label?.trim(),
        value: input.value,
        updatedById: member?.id,
      },
    });

    return { id: goal.id };
  });
