import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteCategoryDiscount = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // deleteMany com organizationId: `delete` por id apagaria regra de outra org.
    const removed = await prisma.priceListCategoryDiscount.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (removed.count === 0) {
      throw errors.NOT_FOUND({ message: "Desconto não encontrado" });
    }
    return { id: input.id };
  });
