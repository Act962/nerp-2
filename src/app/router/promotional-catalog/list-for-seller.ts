import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Lista read-only dos catálogos da org para o App Vendedor: sem config (só o
// necessário para exibir/compartilhar) e com `viewed` = se o vendedor já abriu.
export const listCatalogsForSeller = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar catálogos promocionais (vendedor, read-only)",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        thumbnail: z.string().nullable(),
        createdAt: z.date(),
        viewed: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const [catalogs, views] = await Promise.all([
      prisma.promotionalCatalog.findMany({
        where: { organizationId: context.org.id },
        select: { id: true, name: true, thumbnail: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.catalogView.findMany({
        where: { organizationId: context.org.id, userId: context.user.id },
        select: { catalogId: true },
      }),
    ]);

    const viewedIds = new Set(views.map((v) => v.catalogId));
    return catalogs.map((c) => ({ ...c, viewed: viewedIds.has(c.id) }));
  });
