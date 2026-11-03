import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { listarCondicoes } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Condições de pagamento ativas para o vendedor escolher.
export const listarCondicoesFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => listarCondicoes(context.org.id, true));
