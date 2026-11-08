import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { listarCarteira } from "@/features/forca-vendas/server/clientes";
import { z } from "zod";

// Carteira do vendedor (ou da equipe, para o supervisor), com dívida e dias sem comprar.
export const listarCarteiraFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      busca: z.string().trim().nullish(),
      cursor: z.string().nullish(),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input, context }) =>
    listarCarteira({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    }),
  );
