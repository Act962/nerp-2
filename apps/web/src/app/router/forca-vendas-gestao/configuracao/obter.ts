import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { obterConfiguracao } from "@/features/forca-vendas/server/configuracao";
import { z } from "zod";

// Política comercial da organização.
export const obterConfiguracaoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => obterConfiguracao(context.org.id));
