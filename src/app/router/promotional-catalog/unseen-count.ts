import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Quantos catálogos da org o usuário ainda NÃO abriu — alimenta o badge do
// App Vendedor. Query leve (sem thumbnails).
export const unseenCatalogCount = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Contagem de catálogos não vistos",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(z.object({ count: z.number() }))
  .handler(async ({ context }) => {
    const views = await prisma.catalogView.findMany({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { catalogId: true },
    });
    const viewedIds = views.map((v) => v.catalogId);

    const count = await prisma.promotionalCatalog.count({
      where: {
        organizationId: context.org.id,
        ...(viewedIds.length > 0 && { id: { notIn: viewedIds } }),
      },
    });

    return { count };
  });
