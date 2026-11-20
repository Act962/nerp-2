import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { cancelarPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// O vendedor cancela orçamento e pedido em aprovação; aprovado, só quem aprova.
export const cancelarPedidoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
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
