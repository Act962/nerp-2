import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Lista as faixas de preço de uma tabela — opcionalmente filtrada por produto
// (usado pelo card "Preços por tabela" dentro de editar produto).
export const listProductPrices = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      priceListId: z.string().optional(),
      productId: z.string().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        priceListId: z.string(),
        priceListName: z.string(),
        productId: z.string(),
        productName: z.string(),
        productSalePrice: z.number(),
        minQuantity: z.number(),
        pricingMode: z.enum(["FIXED", "PERCENT_DISCOUNT"]),
        unitPrice: z.number().nullable(),
        percentDiscount: z.number().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context, errors }) => {
    if (!input.priceListId && !input.productId) {
      throw errors.BAD_REQUEST({
        message: "Informe priceListId ou productId",
      });
    }
    const rows = await prisma.productPrice.findMany({
      where: {
        organizationId: context.org.id,
        priceListId: input.priceListId,
        productId: input.productId,
      },
      include: {
        priceList: { select: { name: true } },
        product: { select: { name: true, salePrice: true } },
      },
      orderBy: [{ productId: "asc" }, { minQuantity: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      priceListId: r.priceListId,
      priceListName: r.priceList.name,
      productId: r.productId,
      productName: r.product.name,
      productSalePrice: Number(r.product.salePrice),
      minQuantity: r.minQuantity,
      pricingMode: r.pricingMode,
      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
      percentDiscount:
        r.percentDiscount != null ? Number(r.percentDiscount) : null,
    }));
  });
