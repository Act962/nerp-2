import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

// Remove um padrão. Padrão da org: só quem é da organização. Padrão do sistema:
// só o super usuário.
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
    const found = await prisma.promotionalCatalogTemplate.findUnique({
      where: { id: input.id },
      select: { id: true, scope: true, organizationId: true },
    });
    if (!found) throw errors.NOT_FOUND({ message: "Padrão não encontrado" });

    if (found.scope === "SYSTEM") {
      if (!isSuperUser(context.user.email)) {
        throw errors.FORBIDDEN({
          message: "Apenas o super usuário pode excluir padrões do sistema",
        });
      }
    } else if (found.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }

    await prisma.promotionalCatalogTemplate.delete({ where: { id: input.id } });
    return { success: true };
  });
