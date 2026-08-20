import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Duplica um catálogo (config + miniatura) num novo "Cópia de …" da mesma org.
export const duplicateCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Duplicar catálogo promocional",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const source = await prisma.promotionalCatalog.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { name: true, config: true, thumbnail: true },
    });
    if (!source) throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });

    const created = await prisma.promotionalCatalog.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        name: `Cópia de ${source.name}`,
        config: source.config as object,
        thumbnail: source.thumbnail,
      },
      select: { id: true },
    });
    return { id: created.id };
  });
