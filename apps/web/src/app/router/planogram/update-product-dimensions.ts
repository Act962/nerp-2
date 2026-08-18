import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Procedure estreita de propósito. `products.update` NÃO serve aqui: o input
// dele tem defaults (`minStock: 0`, `images: []`, `isActive: true`,
// `trackStock: true`), então chamá-lo só com as medidas zeraria o estoque
// mínimo e apagaria as imagens do produto. Aqui só as dimensões são tocadas.
export const updateProductDimensions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      widthMm: z.number().int().min(1).max(5000),
      heightMm: z.number().int().min(1).max(5000),
      depthMm: z.number().int().min(1).max(5000).optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      widthMm: z.number().nullable(),
      heightMm: z.number().nullable(),
      depthMm: z.number().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!product) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    }

    return prisma.product.update({
      where: { id: input.id },
      data: {
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        depthMm: input.depthMm,
      },
      select: { id: true, widthMm: true, heightMm: true, depthMm: true },
    });
  });
