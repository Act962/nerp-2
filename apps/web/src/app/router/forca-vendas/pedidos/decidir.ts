import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { decidirPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Supervisor aprova ou recusa pelo celular (exige `forca-vendas-aprovar`).
export const decidirPedidoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
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
