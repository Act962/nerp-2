import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listTradeCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const catalogs = await prisma.tradeCatalog.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        pdfKey: true,
        generatedAt: true,
        shareToken: true,
        isPublic: true,
        _count: { select: { pages: true } },
      },
    });

    return {
      catalogs: catalogs.map((catalog) => ({
        id: catalog.id,
        name: catalog.name,
        status: catalog.status,
        pdfKey: catalog.pdfKey,
        generatedAt: catalog.generatedAt?.toISOString() ?? null,
        shareToken: catalog.shareToken,
        isPublic: catalog.isPublic,
        pagesCount: catalog._count.pages,
      })),
    };
  });
