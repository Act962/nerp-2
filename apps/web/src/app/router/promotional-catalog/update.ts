import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { CatalogConfig } from "./types";

export const updateCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Atualizar catálogo promocional",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      updatedAt: z.date(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.promotionalCatalog.findUnique({
      where: { id: input.id },
    });

    if (!existing || existing.organizationId !== context.org.id) {
      throw errors.NOT_FOUND();
    }

    const mergedConfig = input.config
      ? { ...(existing.config as CatalogConfig), ...input.config }
      : (existing.config as CatalogConfig);

    const updated = await prisma.promotionalCatalog.update({
      where: { id: input.id },
      data: {
        ...(input.name && { name: input.name }),
        config: mergedConfig as object,
      },
    });

    return { id: updated.id, name: updated.name, updatedAt: updated.updatedAt };
  });
