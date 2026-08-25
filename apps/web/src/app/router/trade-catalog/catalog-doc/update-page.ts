import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { catalogRowsSchema } from "@/features/pdv-catalog/lib/catalog-types";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateTradeCatalogPage = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      photoKeys: z.array(z.string()).optional(),
      rows: catalogRowsSchema.optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...rest } = input;

    const page = await prisma.tradeCatalogPage.findFirst({
      where: { id, catalog: { organizationId: context.org.id } },
      select: { id: true },
    });
    if (!page) {
      throw errors.NOT_FOUND({ message: "Página não encontrada" });
    }

    const data: Prisma.TradeCatalogPageUpdateInput = {
      title: rest.title,
      photoKeys: rest.photoKeys,
      rows: rest.rows as Prisma.InputJsonValue | undefined,
    };

    return prisma.tradeCatalogPage.update({
      where: { id },
      data,
      select: { id: true },
    });
  });
