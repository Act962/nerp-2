import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateBrand = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      logo: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    const brand = await prisma.brand.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!brand) {
      throw errors.NOT_FOUND({ message: "Marca não encontrada" });
    }

    return prisma.brand.update({ where: { id }, data });
  });
