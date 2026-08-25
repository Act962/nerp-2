import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
// Reusa o schema do editor de capa dos Books — mesmo formato de CoverElement,
// mesmo canvas 960x540, sem duplicar a validação.
import {
  coverBackgroundSchema,
  coverLayoutSchema,
} from "../../book/cover-layout-schema";

export const updateTradeCatalogCoverLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      coverLayout: coverLayoutSchema,
      closingLayout: coverLayoutSchema,
      coverBackground: coverBackgroundSchema,
      closingBackground: coverBackgroundSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.tradeCatalog.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!catalog) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    return prisma.tradeCatalog.update({
      where: { id: input.id },
      data: {
        coverLayout: input.coverLayout,
        closingLayout: input.closingLayout,
        coverBackground: input.coverBackground,
        closingBackground: input.closingBackground,
      },
      select: { id: true },
    });
  });
