import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { cancelarPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Cancela pedido ainda não faturado.
export const cancelarPedidoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      saleId: z.string().min(1),
      motivo: z.string().max(500).nullish(),
    }),
  )
  .handler(async ({ input, context }) => {
    await cancelarPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
