import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { assertCanEditCatalog } from "./_require-edit";
import { DEFAULT_CONFIG } from "./types";

export const createCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar catálogo promocional",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      name: z.string().min(1),
      // Aparência inicial (ex.: "criar a partir de um padrão"). Mesclada sobre o
      // DEFAULT_CONFIG — o padrão só traz estilo, produtos ficam vazios.
      config: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      config: z.unknown(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await assertCanEditCatalog(context.org.id, context.user.id, errors);

    const catalog = await prisma.promotionalCatalog.create({
      data: {
        name: input.name,
        config: { ...DEFAULT_CONFIG, ...(input.config ?? {}) } as object,
        organizationId: context.org.id,
        createdById: context.user.id,
      },
    });

    return { id: catalog.id, name: catalog.name, config: catalog.config };
  });
