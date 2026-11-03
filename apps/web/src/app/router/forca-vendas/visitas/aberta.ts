import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { visitaAberta } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Visita em andamento (check-in sem check-out) hoje.
export const visitaAbertaFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    visitaAberta(context.org.id, context.vendedor.memberId),
  );
