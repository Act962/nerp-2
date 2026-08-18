import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
export const updateProductPrice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Atualizar preço promocional de um produto via catálogo",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      productId: z.string(),
      promotionalPrice: z.number().positive().nullable(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      promotionalPrice: z.number().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, organizationId: true },
    });

    if (!product || product.organizationId !== context.org.id) {
      throw errors.NOT_FOUND();
    }

    const updated = await prisma.product.update({
      where: { id: input.productId },
      data: {
        promotionalPrice: input.promotionalPrice,
      },
      select: { id: true, promotionalPrice: true },
    });

    return {
      id: updated.id,
      promotionalPrice: updated.promotionalPrice?.toNumber() ?? null,
    };
  });
