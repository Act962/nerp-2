import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { encerrarJornada } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Fecha a jornada e para de registrar a localização.
export const encerrarJornadaFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    encerrarJornada(context.org.id, context.vendedor.memberId),
  );
