import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteNegotiationType = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.negotiationType.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, isSystemDefault: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Tipo de negociação não encontrado" });
    }
    if (existing.isSystemDefault) {
      throw errors.BAD_REQUEST({
        message: "Tipo padrão não pode ser excluído. Desative-o se não usar.",
      });
    }

    return prisma.negotiationType.delete({ where: { id: input.id } });
  });
