import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Marca que o usuário atual abriu um catálogo (zera o badge "não vistos").
export const markCatalogViewed = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Marcar catálogo como visto",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.promotionalCatalog.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!catalog)
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });

    await prisma.catalogView.upsert({
      where: {
        userId_catalogId: { userId: context.user.id, catalogId: catalog.id },
      },
      create: {
        organizationId: context.org.id,
        userId: context.user.id,
        catalogId: catalog.id,
      },
      update: { viewedAt: new Date() },
    });

    return { success: true };
  });
