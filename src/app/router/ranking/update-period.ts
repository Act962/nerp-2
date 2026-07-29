import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { periodTypeSchema } from "./_schemas";

const updateSalesGoalPeriodInputSchema = z.object({
  periodType: periodTypeSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  // Meta geral do mês (org inteira) — sobrescreve a soma das metas das
  // equipes no ranking. `null` limpa o override e volta pra soma.
  overallGoalAmount: z.number().nonnegative().nullable(),
});

// Define a meta geral do período (mês/semana/etc.), independente da soma das
// metas de cada equipe — usado pelo modo "Meta geral do mês" do diálogo de
// adicionar. Faz upsert do período (mesmo padrão de createEntry/createBranch)
// pra funcionar mesmo antes de existir qualquer equipe/vendedor cadastrado.
export const updateSalesGoalPeriod = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Definir a meta geral do período",
    tags: ["ranking"],
  })
  .input(updateSalesGoalPeriodInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    const period = await prisma.salesGoalPeriod.upsert({
      where: {
        organizationId_periodType_periodStart: {
          organizationId: context.org.id,
          periodType: input.periodType,
          periodStart,
        },
      },
      create: {
        organizationId: context.org.id,
        periodType: input.periodType,
        periodStart,
        periodEnd,
        importedByUserId: context.user.id,
        overallGoalAmount: input.overallGoalAmount,
      },
      update: { overallGoalAmount: input.overallGoalAmount },
    });

    return {
      periodId: period.id,
      overallGoalAmount:
        period.overallGoalAmount !== null
          ? Number(period.overallGoalAmount)
          : null,
    };
  });
