import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const reorderTradeCatalogPages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      catalogId: z.string(),
      orderedPageIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.tradeCatalog.findFirst({
      where: { id: input.catalogId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!catalog) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    await prisma.$transaction(
      input.orderedPageIds.map((pageId, index) =>
        prisma.tradeCatalogPage.updateMany({
          where: { id: pageId, catalogId: input.catalogId },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  });
