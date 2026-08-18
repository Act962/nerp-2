import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteMediaType = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.mediaType.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, isSystemDefault: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Mídia não encontrada" });
    }
    // Padrão da Biblioteca Nacional: não pode excluir, só desativar.
    if (existing.isSystemDefault) {
      throw errors.BAD_REQUEST({
        message: "Mídia padrão não pode ser excluída. Desative-a se não usar.",
      });
    }

    return prisma.mediaType.delete({ where: { id: input.id } });
  });
