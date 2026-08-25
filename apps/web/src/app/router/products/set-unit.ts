import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ProductUnit } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

// Define a unidade de venda (ProductUnit) de um produto NO CADASTRO. Editada
// pelo catálogo promocional, altera o produto de verdade (reflete em todo
// lugar). Multi-tenant: valida o produto pela org antes de escrever.
export const setProductUnit = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Definir a unidade de venda de um produto",
    tags: ["products"],
  })
  .input(
    z.object({
      productId: z.string(),
      unit: z.enum(ProductUnit),
    }),
  )
  .output(z.object({ id: z.string(), unit: z.enum(ProductUnit) }))
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const updated = await prisma.product.update({
      where: { id: input.productId },
      data: { unit: input.unit },
      select: { id: true, unit: true },
    });

    return { id: updated.id, unit: updated.unit };
  });
