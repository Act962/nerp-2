import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  MISSING_FIELDS,
  missingWhere,
} from "@/features/products/lib/missing-filters";
import prisma from "@/lib/db";
import { z } from "zod";

// Indicadores de qualidade do cadastro de produtos.
//
// Uma transação com todas as contagens: sete idas separadas ao banco a cada
// abertura da tela pesariam sem necessidade, e ainda poderiam devolver números
// de instantes diferentes entre si.
export const productGapsSummary = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .output(
    z.object({
      total: z.number(),
      category: z.number(),
      stock: z.number(),
      price: z.number(),
      sku: z.number(),
      barcode: z.number(),
      image: z.number(),
    }),
  )
  .handler(async ({ context }) => {
    const org = { organizationId: context.org.id };

    const [total, ...contagens] = await prisma.$transaction([
      prisma.product.count({ where: org }),
      ...MISSING_FIELDS.map((field) =>
        prisma.product.count({ where: { ...org, ...missingWhere(field) } }),
      ),
    ]);

    const porCampo = Object.fromEntries(
      MISSING_FIELDS.map((field, i) => [field, contagens[i]]),
    ) as Record<(typeof MISSING_FIELDS)[number], number>;

    return { total, ...porCampo };
  });
