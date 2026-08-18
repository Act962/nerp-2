import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteBrand = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const brand = await prisma.brand.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!brand) {
      throw errors.NOT_FOUND({ message: "Marca não encontrada" });
    }

    return prisma.brand.delete({ where: { id: input.id } });
  });
