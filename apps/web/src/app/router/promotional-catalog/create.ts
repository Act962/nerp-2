import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { DEFAULT_CONFIG } from "./types";

export const createCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar catálogo promocional",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ name: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      config: z.unknown(),
    }),
  )
  .handler(async ({ input, context }) => {
    const catalog = await prisma.promotionalCatalog.create({
      data: {
        name: input.name,
        config: DEFAULT_CONFIG,
        organizationId: context.org.id,
        createdById: context.user.id,
      },
    });

    return { id: catalog.id, name: catalog.name, config: catalog.config };
  });
