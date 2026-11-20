import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { listarAvisosDoGestor } from "@/features/forca-vendas/server/avisos";
import { z } from "zod";

// Avisos publicados com "lido por X de Y".
export const listarAvisosGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => listarAvisosDoGestor(context.org.id));
