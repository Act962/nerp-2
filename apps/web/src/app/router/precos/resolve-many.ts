import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { z } from "zod";

// Usado pelo PDV pra recalcular preços do carrinho quando o cliente muda,
// e por qualquer outra tela que precise consultar o preço "vigente".
// Se `customerId` é informado, extrai o `priceListId` do cliente; senão usa
// o override explícito ou cai na default da org.
export const resolveManyPricesProcedure = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      customerId: z.string().optional(),
      priceListId: z.string().nullable().optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.number().positive().default(1),
          }),
        )
        .min(1),
    }),
  )
  .output(
    z.object({
      priceListId: z.string().nullable(),
      lines: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          appliedDiscountPercent: z.number().nullable(),
          resolvedFrom: z.enum([
            "tier-fixed",
            "tier-percent",
            "product-discount",
            "category-discount",
            "product",
          ]),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    let priceListId: string | null | undefined = input.priceListId ?? undefined;

    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, organizationId: context.org.id },
        select: { priceListId: true },
      });
      if (!customer) {
        throw errors.NOT_FOUND({ message: "Cliente não encontrado" });
      }
      // Override explícito da linha de request vence o do cliente, senão
      // pega do cliente.
      if (input.priceListId === undefined) priceListId = customer.priceListId;
    }

    const results = await resolveManyPrices({
      organizationId: context.org.id,
      priceListId,
      items: input.items,
    });

    return {
      priceListId: results[0]?.priceListId ?? null,
      lines: results.map((r) => ({
        productId: r.productId,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        appliedDiscountPercent: r.appliedDiscountPercent,
        resolvedFrom: r.resolvedFrom,
      })),
    };
  });
