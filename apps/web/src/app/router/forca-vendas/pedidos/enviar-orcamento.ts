import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { enviarOrcamento } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Orçamento vira pedido, com as regras de agora.
export const enviarOrcamentoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ saleId: z.string().min(1) }))
  .handler(async ({ input, context }) =>
    enviarOrcamento({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      saleId: input.saleId,
    }),
  );
