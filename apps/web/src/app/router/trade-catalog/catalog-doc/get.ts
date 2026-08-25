import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { catalogRowsSchema } from "@/features/pdv-catalog/lib/catalog-types";
import prisma from "@/lib/db";
import { z } from "zod";

export const getTradeCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.tradeCatalog.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      include: { pages: { orderBy: { order: "asc" } } },
    });

    if (!catalog) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    return {
      id: catalog.id,
      name: catalog.name,
      status: catalog.status,
      pdfKey: catalog.pdfKey,
      generatedAt: catalog.generatedAt?.toISOString() ?? null,
      shareToken: catalog.shareToken,
      isPublic: catalog.isPublic,
      showIndex: catalog.showIndex,
      coverLayout: catalog.coverLayout,
      closingLayout: catalog.closingLayout,
      coverBackground: catalog.coverBackground,
      closingBackground: catalog.closingBackground,
      pages: catalog.pages.map((page) => {
        const parsedRows = catalogRowsSchema.safeParse(page.rows);
        return {
          id: page.id,
          title: page.title,
          mediaTypeCode: page.mediaTypeCode,
          order: page.order,
          photoKeys: page.photoKeys,
          rows: parsedRows.success ? parsedRows.data : [],
        };
      }),
    };
  });
