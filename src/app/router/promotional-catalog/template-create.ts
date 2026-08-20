import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Salva o padrão (preset de estilo) com um título e a miniatura opcional. O
// `config` já vem sem os campos de produto — é só a aparência.
export const createCatalogTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Salvar padrão de catálogo",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      name: z.string().min(1, "Informe o título do padrão"),
      config: z.record(z.string(), z.unknown()),
      thumbnail: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.promotionalCatalogTemplate.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        name: input.name,
        config: input.config as object,
        thumbnail: input.thumbnail ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  });
