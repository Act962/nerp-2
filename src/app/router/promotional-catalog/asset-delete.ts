import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Remove uma etiqueta da biblioteca (org-scoped). Não apaga o objeto no R2 —
// pode estar em uso em catálogos já salvos.
export const deleteCatalogAsset = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Excluir etiqueta do catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const { count } = await prisma.catalogAsset.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Etiqueta não encontrada" });
    return { success: true };
  });
