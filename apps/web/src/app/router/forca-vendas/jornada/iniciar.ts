import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { iniciarJornada } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Abre a jornada: a partir daqui o módulo registra a localização.
export const iniciarJornadaFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    iniciarJornada(context.org.id, context.vendedor.memberId),
  );
