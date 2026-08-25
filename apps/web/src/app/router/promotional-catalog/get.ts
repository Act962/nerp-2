import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const getCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Buscar catálogo promocional por id",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      config: z.unknown(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.promotionalCatalog.findUnique({
      where: { id: input.id },
    });

    if (!catalog || catalog.organizationId !== context.org.id) {
      throw errors.NOT_FOUND();
    }

    return {
      id: catalog.id,
      name: catalog.name,
      config: catalog.config,
      createdAt: catalog.createdAt,
      updatedAt: catalog.updatedAt,
    };
  });
