import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { detalharPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Pedido completo para o receptor.
export const detalharPedidoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({ saleId: z.string().min(1) }))
  .handler(async ({ input, context }) =>
    detalharPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      saleId: input.saleId,
    }),
  );
