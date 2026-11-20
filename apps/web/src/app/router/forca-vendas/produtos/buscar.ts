import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { buscarProdutos } from "@/features/forca-vendas/server/produtos";
import { z } from "zod";

// Busca por nome, código, código de barras ou marca, com o preço do cliente.
export const buscarProdutosFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      busca: z.string().trim().nullish(),
      customerId: z.string().nullish(),
      apenasOfertas: z.boolean().default(false),
      cursor: z.string().nullish(),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input, context }) =>
    buscarProdutos({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    }),
  );
