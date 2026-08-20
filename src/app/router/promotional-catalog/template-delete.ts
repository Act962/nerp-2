import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Remove um padrão. Valida a organização antes (deleteMany por id + org evita
// apagar padrão de outro tenant).
export const deleteCatalogTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Excluir padrão de catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const { count } = await prisma.promotionalCatalogTemplate.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    return { success: true };
  });
