import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteTradeCatalogPage = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const page = await prisma.tradeCatalogPage.findFirst({
      where: { id: input.id, catalog: { organizationId: context.org.id } },
      select: { id: true },
    });
    if (!page) {
      throw errors.NOT_FOUND({ message: "Página não encontrada" });
    }

    return prisma.tradeCatalogPage.delete({ where: { id: input.id } });
  });
