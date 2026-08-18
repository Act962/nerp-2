import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { entryKindSchema, periodTypeSchema } from "./_schemas";

const importEntrySchema = z.object({
  externalCode: z.string().min(1),
  sellerName: z.string().min(1),
  goalName: z.string().min(1),
  goalAmount: z.number().nonnegative(),
  entryKind: entryKindSchema,
  // Enviado apenas pelo assistente de configuração manual; a planilha não
  // conhece membros do NERP. undefined = não mexe no vínculo existente.
  memberId: z.string().nullable().optional(),
  // Chave S3 da foto do participante (assistente manual). undefined = mantém
  // a foto atual; null = remove.
  photoUrl: z.string().nullable().optional(),
});

const importBranchSchema = z.object({
  name: z.string().min(1),
  // Enviado só pelo assistente de configuração. undefined = não mexe no
  // estado atual (import de planilha preserva equipes ativas/inativas).
  isActive: z.boolean().optional(),
  entries: z.array(importEntrySchema),
});

const importSalesGoalRankingInputSchema = z.object({
  periodType: periodTypeSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  label: z.string().optional(),
  sourceFileName: z.string().optional(),
  branches: z.array(importBranchSchema).min(1),
  // true = o payload é a configuração completa do período: equipes e entries
  // ausentes são removidas (assistente manual). false/ausente = só upsert
  // (import de planilha, que pode ser parcial).
  prune: z.boolean().optional(),
});

// Reimportar o mesmo período (mesma organização + periodType + periodStart)
// atualiza valores em vez de duplicar linhas — upsert por externalCode.
// O update da entry não toca achievedAmount, e só toca memberId quando o
// payload envia o campo (assistente manual): reimport de planilha preserva
// vínculos com membros e ajustes manuais.
export const importSalesGoalRanking = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Importar planilha de metas",
    tags: ["ranking"],
  })
  .input(importSalesGoalRankingInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    const linkedMemberIds = [
      ...new Set(
        input.branches
          .flatMap((branch) => branch.entries)
          .map((entry) => entry.memberId)
          .filter((memberId): memberId is string => Boolean(memberId)),
      ),
    ];
    if (linkedMemberIds.length > 0) {
      const memberCount = await prisma.member.count({
        where: { id: { in: linkedMemberIds }, organizationId: context.org.id },
      });
      if (memberCount !== linkedMemberIds.length) {
        throw errors.NOT_FOUND({
          message: "Algum membro vinculado não pertence a esta organização.",
        });
      }
    }

    return prisma.$transaction(
      async (tx) => {
        const period = await tx.salesGoalPeriod.upsert({
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
            label: input.label,
            sourceFileName: input.sourceFileName,
            importedByUserId: context.user.id,
          },
          update: {
            periodEnd,
            label: input.label,
            sourceFileName: input.sourceFileName,
            importedAt: new Date(),
            importedByUserId: context.user.id,
          },
        });

        let branchesCount = 0;
        let entriesCount = 0;
        const keptBranchIds: string[] = [];

        for (const [index, branchInput] of input.branches.entries()) {
          const branch = await tx.salesGoalBranch.upsert({
            where: {
              periodId_name: { periodId: period.id, name: branchInput.name },
            },
            create: {
              periodId: period.id,
              name: branchInput.name,
              sortOrder: index,
              isActive: branchInput.isActive ?? true,
            },
            update: {
              sortOrder: index,
              ...(branchInput.isActive !== undefined
                ? { isActive: branchInput.isActive }
                : {}),
            },
          });
          branchesCount += 1;
          keptBranchIds.push(branch.id);

          for (const entryInput of branchInput.entries) {
            await tx.salesGoalEntry.upsert({
              where: {
                branchId_externalCode: {
                  branchId: branch.id,
                  externalCode: entryInput.externalCode,
                },
              },
              create: {
                branchId: branch.id,
                externalCode: entryInput.externalCode,
                sellerName: entryInput.sellerName,
                goalName: entryInput.goalName,
                goalAmount: entryInput.goalAmount,
                entryKind: entryInput.entryKind,
                memberId: entryInput.memberId ?? null,
                photoUrl: entryInput.photoUrl ?? null,
              },
              update: {
                sellerName: entryInput.sellerName,
                goalName: entryInput.goalName,
                goalAmount: entryInput.goalAmount,
                entryKind: entryInput.entryKind,
                ...(entryInput.memberId !== undefined
                  ? { memberId: entryInput.memberId }
                  : {}),
                ...(entryInput.photoUrl !== undefined
                  ? { photoUrl: entryInput.photoUrl }
                  : {}),
              },
            });
            entriesCount += 1;
          }

          if (input.prune) {
            await tx.salesGoalEntry.deleteMany({
              where: {
                branchId: branch.id,
                externalCode: {
                  notIn: branchInput.entries.map(
                    (entryInput) => entryInput.externalCode,
                  ),
                },
              },
            });
          }
        }

        if (input.prune) {
          await tx.salesGoalBranch.deleteMany({
            where: { periodId: period.id, id: { notIn: keptBranchIds } },
          });
        }

        return { periodId: period.id, branchesCount, entriesCount };
      },
      { timeout: 30_000 },
    );
  });
