import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

export const deleteSalesGoalEntry = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover uma entry do ranking",
    tags: ["ranking"],
  })
  .input(z.object({ entryId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const entry = await prisma.salesGoalEntry.findFirst({
      where: {
        id: input.entryId,
        branch: { period: { organizationId: context.org.id } },
      },
    });
    if (!entry) {
      throw errors.NOT_FOUND({ message: "Meta não encontrada." });
    }

    await prisma.salesGoalEntry.delete({ where: { id: input.entryId } });
    return { deleted: true as const };
  });
