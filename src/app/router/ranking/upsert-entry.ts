import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";
import { entryKindSchema } from "./_schemas";

const upsertSalesGoalEntryInputSchema = z.object({
  entryId: z.string(),
  sellerName: z.string().min(1).optional(),
  goalName: z.string().min(1).optional(),
  goalAmount: z.number().nonnegative().optional(),
  achievedAmount: z.number().nonnegative().nullable().optional(),
  entryKind: entryKindSchema.optional(),
  memberId: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  // Move a entry pra outra equipe do MESMO período (aba "Vendedores" das
  // Configurações). Trocar de período junto viraria import por fora do fluxo
  // normal — fora de escopo aqui.
  branchId: z.string().optional(),
});

// Entry vinculada a um Member tem o vendido calculado das vendas, mas um
// achievedAmount informado aqui vira override manual (achievedIsManual) e
// passa a valer — útil quando parte das vendas não está no NERP. Enviar
// achievedAmount: null limpa o override e devolve a entry ao automático.
export const upsertSalesGoalEntry = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar meta/vendido/vínculo de uma entry",
    tags: ["ranking"],
  })
  .input(upsertSalesGoalEntryInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const entry = await prisma.salesGoalEntry.findFirst({
      where: {
        id: input.entryId,
        branch: { period: { organizationId: context.org.id } },
      },
      select: {
        id: true,
        externalCode: true,
        branch: { select: { periodId: true } },
      },
    });
    if (!entry) {
      throw errors.NOT_FOUND({ message: "Meta não encontrada." });
    }

    if (input.memberId) {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!member) {
        throw errors.NOT_FOUND({
          message: "Membro não encontrado nesta organização.",
        });
      }
    }

    if (input.branchId) {
      const targetBranch = await prisma.salesGoalBranch.findFirst({
        where: {
          id: input.branchId,
          periodId: entry.branch.periodId,
          period: { organizationId: context.org.id },
        },
        select: { id: true },
      });
      if (!targetBranch) {
        throw errors.NOT_FOUND({
          message: "Equipe de destino não encontrada neste período.",
        });
      }
      const codeTaken = await prisma.salesGoalEntry.findFirst({
        where: {
          branchId: input.branchId,
          externalCode: entry.externalCode,
          id: { not: entry.id },
        },
        select: { id: true },
      });
      if (codeTaken) {
        throw errors.BAD_REQUEST({
          message:
            "Já existe um vendedor com este código na equipe de destino.",
        });
      }
    }

    const updated = await prisma.salesGoalEntry.update({
      where: { id: input.entryId },
      data: {
        sellerName: input.sellerName,
        goalName: input.goalName,
        goalAmount: input.goalAmount,
        achievedAmount: input.achievedAmount,
        achievedIsManual:
          input.achievedAmount !== undefined
            ? input.achievedAmount !== null
            : undefined,
        entryKind: input.entryKind,
        memberId: input.memberId,
        photoUrl: input.photoUrl,
        branchId: input.branchId,
      },
    });

    return {
      id: updated.id,
      externalCode: updated.externalCode,
      goalName: updated.goalName,
      sellerName: updated.sellerName,
      entryKind: updated.entryKind,
      goalAmount: Number(updated.goalAmount),
      achievedAmount:
        updated.achievedAmount !== null ? Number(updated.achievedAmount) : null,
      achievedIsManual: updated.achievedIsManual,
      memberId: updated.memberId,
      photoUrl: updated.photoUrl,
      branchId: updated.branchId,
    };
  });
