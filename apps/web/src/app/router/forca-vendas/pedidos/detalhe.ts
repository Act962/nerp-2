import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { detalharPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Pedido completo, com motivos de aprovação e situação no destino.
export const detalharPedidoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ saleId: z.string().min(1) }))
  .handler(async ({ input, context }) =>
    detalharPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      saleId: input.saleId,
    }),
  );
