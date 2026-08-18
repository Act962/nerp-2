import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Upsert de faixa de preço. Se `unitPrice` for informado, modo FIXED;
// se `percentDiscount` for informado, modo PERCENT_DISCOUNT. Um e apenas um.
export const setProductPrice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        productId: z.string(),
        priceListId: z.string(),
        minQuantity: z.number().int().min(1).default(1),
        unitPrice: z.number().positive().optional(),
        percentDiscount: z.number().gt(0).lte(100).optional(),
      })
      .refine(
        (data) =>
          (data.unitPrice != null && data.percentDiscount == null) ||
          (data.percentDiscount != null && data.unitPrice == null),
        {
          message: "Informe unitPrice OU percentDiscount, não ambos",
          path: ["unitPrice"],
        },
      ),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // Valida ownership do produto e da tabela.
    const [product, priceList] = await Promise.all([
      prisma.product.findFirst({
        where: { id: input.productId, organizationId: context.org.id },
        select: { id: true },
      }),
      prisma.priceList.findFirst({
        where: { id: input.priceListId, organizationId: context.org.id },
        select: { id: true },
      }),
    ]);
    if (!product) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    }
    if (!priceList) {
      throw errors.NOT_FOUND({ message: "Tabela de preço não encontrada" });
    }

    const pricingMode = input.unitPrice != null ? "FIXED" : "PERCENT_DISCOUNT";

    const row = await prisma.productPrice.upsert({
      where: {
        productId_priceListId_minQuantity: {
          productId: input.productId,
          priceListId: input.priceListId,
          minQuantity: input.minQuantity,
        },
      },
      create: {
        organizationId: context.org.id,
        productId: input.productId,
        priceListId: input.priceListId,
        minQuantity: input.minQuantity,
        pricingMode,
        unitPrice: input.unitPrice ?? null,
        percentDiscount: input.percentDiscount ?? null,
      },
      update: {
        pricingMode,
        unitPrice: input.unitPrice ?? null,
        percentDiscount: input.percentDiscount ?? null,
      },
      select: { id: true },
    });

    return { id: row.id };
  });
