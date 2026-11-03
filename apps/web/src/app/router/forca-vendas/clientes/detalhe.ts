import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { detalharCliente } from "@/features/forca-vendas/server/clientes";
import { z } from "zod";

// Ficha 360º do cliente: crédito, títulos, últimas compras e quem atende.
export const detalharClienteFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ customerId: z.string().min(1) }))
  .handler(async ({ input, context }) =>
    detalharCliente({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      customerId: input.customerId,
    }),
  );
