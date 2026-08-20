import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Atualiza um padrão existente com a aparência atual do catálogo (config +
// miniatura). Usado pelo "Atualizar padrão atual".
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
    const { count } = await prisma.promotionalCatalogTemplate.updateMany({
      where: { id: input.id, organizationId: context.org.id },
      data: {
        ...(input.name && { name: input.name }),
        config: input.config as object,
        ...(input.thumbnail !== undefined && { thumbnail: input.thumbnail }),
      },
    });
    if (count === 0)
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    return { success: true };
  });
