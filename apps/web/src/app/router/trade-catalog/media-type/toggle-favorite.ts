import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Alterna o "favorito" de um tipo de mídia (por ORG). Favoritos aparecem
// primeiro no seletor de mídia (ex.: card de aprovação de fotos).
export const toggleMediaTypeFavorite = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), isFavorite: z.boolean() }))
  .output(z.object({ id: z.string(), isFavorite: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const found = await prisma.mediaType.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!found) {
      throw errors.NOT_FOUND({ message: "Tipo de mídia não encontrado" });
    }
    return prisma.mediaType.update({
      where: { id: input.id },
      data: { isFavorite: input.isFavorite },
      select: { id: true, isFavorite: true },
    });
  });
