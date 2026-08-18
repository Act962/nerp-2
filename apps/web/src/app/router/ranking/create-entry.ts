import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { periodTypeSchema } from "./_schemas";

const createSalesGoalEntryInputSchema = z.object({
  periodType: periodTypeSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  branchName: z.string().min(1),
  sellerName: z.string().min(1),
  goalAmount: z.number().nonnegative(),
  achievedAmount: z.number().nonnegative().optional(),
});

// Cria meta manualmente (sem planilha): garante período + equipe (upsert por
// nome) e cria a entry com um externalCode sintético, já que não vem do
// Winthor.
export const createSalesGoalEntry = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Adicionar equipe/vendedor com meta manualmente",
    tags: ["ranking"],
  })
  .input(createSalesGoalEntryInputSchema)
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
      create: { periodId: period.id, name: input.branchName },
      update: {},
    });

    const entry = await prisma.salesGoalEntry.create({
      data: {
        branchId: branch.id,
        externalCode: `manual-${crypto.randomUUID()}`,
        sellerName: input.sellerName,
        goalName: input.sellerName,
        goalAmount: input.goalAmount,
        achievedAmount: input.achievedAmount ?? null,
        entryKind: "SELLER",
      },
    });

    return {
      periodId: period.id,
      branchId: branch.id,
      entryId: entry.id,
    };
  });
