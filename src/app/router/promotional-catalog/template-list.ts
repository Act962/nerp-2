import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Lista os padrões (presets de estilo) da organização, mais recentes primeiro.
export const listCatalogTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar padrões de catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        config: z.unknown(),
        thumbnail: z.string().nullable(),
        createdAt: z.date(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const templates = await prisma.promotionalCatalogTemplate.findMany({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        config: true,
        thumbnail: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return templates;
  });
