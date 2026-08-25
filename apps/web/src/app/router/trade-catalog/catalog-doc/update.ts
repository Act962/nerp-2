import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateTradeCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      isPublic: z.boolean().optional(),
      showIndex: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    const catalog = await prisma.tradeCatalog.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!catalog) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    return prisma.tradeCatalog.update({
      where: { id },
      data,
      select: { id: true },
    });
  });
