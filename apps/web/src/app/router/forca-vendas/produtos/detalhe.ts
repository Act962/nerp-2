import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { detalharProduto } from "@/features/forca-vendas/server/produtos";
import { z } from "zod";

// Produto 360º: estoque por filial, preço do cliente, cubagem e o que ele já comprou.
export const detalharProdutoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      productId: z.string().min(1),
      customerId: z.string().nullish(),
    }),
  )
  .handler(async ({ input, context }) =>
    detalharProduto({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    }),
  );
