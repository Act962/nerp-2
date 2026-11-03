import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { estadoDaJornada } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Jornada aberta ou não.
export const estadoDaJornadaFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    estadoDaJornada(context.org.id, context.vendedor.memberId),
  );
