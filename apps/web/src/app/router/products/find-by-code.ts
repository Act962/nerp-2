import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Busca exata por código de barras ou SKU (código interno), escopada à org.
// Usada no scan do PDV (leitor e código pesável da balança).
export const findProductByCode = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ code: z.string().min(1) }))
  .output(
    z.object({
      product: z
        .object({
          id: z.string(),
          name: z.string(),
          sku: z.string().nullable(),
          barcode: z.string().nullable(),
          salePrice: z.number(),
          // Custo e controle de estoque: a entrada de nota precisa deles para
          // sugerir o preço de venda e decidir se gera movimento. O PDV, que
          // também chama este procedure, simplesmente ignora.
          costPrice: z.number(),
          currentStock: z.number(),
          trackStock: z.boolean(),
          unit: z.string(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const code = input.code.trim();
    const product = await prisma.product.findFirst({
      where: {
        organizationId: context.org.id,
        OR: [{ barcode: code }, { sku: code }],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        costPrice: true,
        currentStock: true,
        trackStock: true,
        unit: true,
      },
    });
    if (!product) return { product: null };
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        salePrice: Number(product.salePrice),
        costPrice: Number(product.costPrice),
        currentStock: Number(product.currentStock),
        trackStock: product.trackStock,
        unit: product.unit,
      },
    };
  });
