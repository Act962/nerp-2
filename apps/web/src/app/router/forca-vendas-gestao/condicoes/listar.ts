import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { listarCondicoes } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Todas as condições de pagamento, ativas e inativas.
export const listarCondicoesGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => listarCondicoes(context.org.id, false));
