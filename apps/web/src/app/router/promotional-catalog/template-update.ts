import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

// Atualiza um padrão existente com a aparência atual do catálogo (config +
// miniatura). Padrão da org: só quem é da organização; padrão do sistema: só o
// super usuário.
export const updateCatalogTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar padrão de catálogo",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      config: z.record(z.string(), z.unknown()),
      thumbnail: z.string().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const found = await prisma.promotionalCatalogTemplate.findUnique({
      where: { id: input.id },
      select: { id: true, scope: true, organizationId: true },
    });
    if (!found) throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    if (found.scope === "SYSTEM") {
      if (!isSuperUser(context.user.email))
        throw errors.FORBIDDEN({
          message: "Apenas o super usuário pode editar padrões do sistema",
        });
    } else if (found.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }
    await prisma.promotionalCatalogTemplate.update({
      where: { id: input.id },
      data: {
        ...(input.name && { name: input.name }),
        config: input.config as object,
        ...(input.thumbnail !== undefined && { thumbnail: input.thumbnail }),
      },
    });
    return { success: true };
  });
