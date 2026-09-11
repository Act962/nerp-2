import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { assertDentroDoLimite } from "@/features/billing/server/limites";
import prisma from "@/lib/db";
import { z } from "zod";

export const duplicateProduct = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/products/duplicate",
    summary: "Duplicate a product",
  })
  .input(
    z.object({
      productId: z.string(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      slug: z.string(),
      productName: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
    });

    if (!product) {
      throw errors.NOT_FOUND({
        message: "Produto não encontrado",
      });
    }

    await assertDentroDoLimite(context.org.id, "produtos");

    const newSlug = `${product.slug}-${Date.now()}`;

    const duplicatedProduct = await prisma.product.create({
      data: {
        ...product,
        id: undefined,
        slug: newSlug,
      },
    });

    return {
      id: duplicatedProduct.id,
      slug: duplicatedProduct.slug,
      productName: duplicatedProduct.name,
    };
  });
