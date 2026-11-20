import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  selecaoEmMassaShape,
  selecaoEmMassaValida,
  whereDaSelecao,
} from "@/features/products/server/selecao-em-massa";
import prisma from "@/lib/db";

// Reajusta o preço de venda de vários produtos de uma vez, por percentual:
//   - base "venda": venda atual ± X% (reajuste de tabela).
//   - base "custo": venda = custo + X% (margem). Produto sem custo fica de fora
//     — aplicar margem sobre zero zeraria o preço de venda.
// Não dispara o alerta de queda de preço do Shopper (`shopper/price.changed`):
// um evento por produto num reajuste de milhares de itens não cabe no Inngest.
export const bulkAdjustProductPrice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        ...selecaoEmMassaShape,
        base: z.enum(["venda", "custo"]),
        percentual: z
          .number()
          .min(-90)
          .max(1000)
          .refine((valor) => valor !== 0, { message: "Informe o percentual" }),
      })
      .refine(selecaoEmMassaValida, {
        message: "Informe productIds ou all: true",
      }),
  )
  .output(z.object({ updated: z.number(), semCusto: z.number() }))
  .handler(async ({ input, context }) => {
    const where = whereDaSelecao(context.org.id, input);
    const fator = 1 + input.percentual / 100;

    if (input.base === "venda") {
      const result = await prisma.product.updateMany({
        where,
        data: { salePrice: { multiply: fator } },
      });
      return { updated: result.count, semCusto: 0 };
    }

    const [semCusto, alvos] = await Promise.all([
      prisma.product.count({
        where: { AND: [where, { costPrice: { lte: 0 } }] },
      }),
      prisma.product.findMany({
        where: { AND: [where, { costPrice: { gt: 0 } }] },
        select: { id: true },
      }),
    ]);
    const ids = alvos.map((produto) => produto.id);
    if (ids.length === 0) return { updated: 0, semCusto };

    // Prisma não calcula uma coluna a partir de outra no updateMany.
    const updated = await prisma.$executeRaw`
      UPDATE "products"
      SET "salePrice" = ROUND("costPrice" * ${fator}::numeric, 2), "updatedAt" = NOW()
      WHERE "organizationId" = ${context.org.id} AND "id" = ANY(${ids})
    `;
    return { updated, semCusto };
  });
