import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

// Remove a equipe e, em cascata (FK onDelete: Cascade), todos os vendedores
// dela. Sem confirmação aqui — o client pede confirmação antes de chamar.
export const deleteSalesGoalBranch = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover uma equipe do ranking",
    tags: ["ranking"],
  })
  .input(z.object({ branchId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const branch = await prisma.salesGoalBranch.findFirst({
      where: {
        id: input.branchId,
        period: { organizationId: context.org.id },
      },
    });
    if (!branch) {
      throw errors.NOT_FOUND({ message: "Equipe não encontrada." });
    }

    await prisma.salesGoalBranch.delete({ where: { id: input.branchId } });
    return { deleted: true as const };
  });
