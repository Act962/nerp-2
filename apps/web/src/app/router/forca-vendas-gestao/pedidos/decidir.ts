import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { decidirPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Aprova ou recusa um pedido em aprovação.
export const decidirPedidoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      saleId: z.string().min(1),
      aprovar: z.boolean(),
      motivoRecusa: z.string().max(500).nullish(),
    }),
  )
  .handler(async ({ input, context }) => {
    await decidirPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
