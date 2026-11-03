import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { faturarPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Fatura: baixa estoque, gera os títulos por parcela e lança o flex.
export const faturarPedidoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      saleId: z.string().min(1),
      cortes: z
        .array(
          z.object({
            itemId: z.string().min(1),
            quantidade: z.number().min(0),
          }),
        )
        .max(200)
        .default([]),
    }),
  )
  .handler(async ({ input, context }) => {
    await faturarPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
