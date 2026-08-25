import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { periodTypeSchema } from "./_schemas";

const createSalesGoalBranchInputSchema = z.object({
  periodType: periodTypeSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  branchName: z.string().min(1),
  // Meta geral da equipe (opcional) — quando informada, sobrescreve a soma
  // das metas dos vendedores dela no ranking.
  goalAmountOverride: z.number().nonnegative().nullable().optional(),
});

// Cria (ou reaproveita) equipe manualmente, sem precisar adicionar um
// vendedor junto — usado tanto pelo botão "+ Nova equipe" das Configurações
// quanto pelo modo "Meta da equipe" do diálogo de adicionar.
export const createSalesGoalBranch = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Adicionar equipe manualmente",
    tags: ["ranking"],
  })
  .input(createSalesGoalBranchInputSchema)
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
      },
      update: {},
    });

    const branch = await prisma.salesGoalBranch.upsert({
      where: {
        periodId_name: { periodId: period.id, name: input.branchName },
      },
      create: {
        periodId: period.id,
        name: input.branchName,
        goalAmountOverride: input.goalAmountOverride ?? null,
      },
      update:
        input.goalAmountOverride !== undefined
          ? { goalAmountOverride: input.goalAmountOverride }
          : {},
    });

    return {
      periodId: period.id,
      branchId: branch.id,
      name: branch.name,
    };
  });
