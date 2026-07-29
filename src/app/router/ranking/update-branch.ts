import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

const updateSalesGoalBranchInputSchema = z.object({
  branchId: z.string(),
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  // Meta geral da equipe — sobrescreve a soma das metas dos vendedores dela.
  // `null` limpa o override e volta pra soma; `undefined` não mexe no campo.
  goalAmountOverride: z.number().nonnegative().nullable().optional(),
});

// Renomear/reordenar aqui vale só até o próximo import da planilha: o
// import recria a filial pelo nome original (upsert por [periodId, name]).
export const updateSalesGoalBranch = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Renomear/reordenar/ativar equipe",
    tags: ["ranking"],
  })
  .input(updateSalesGoalBranchInputSchema)
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const branch = await prisma.salesGoalBranch.findFirst({
      where: { id: input.branchId, period: { organizationId: context.org.id } },
    });
    if (!branch) {
      throw errors.NOT_FOUND({ message: "Equipe não encontrada." });
    }

    const updated = await prisma.salesGoalBranch.update({
      where: { id: input.branchId },
      data: {
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        goalAmountOverride: input.goalAmountOverride,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      goalAmountOverride:
        updated.goalAmountOverride !== null
          ? Number(updated.goalAmountOverride)
          : null,
    };
  });
