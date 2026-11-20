import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { mapaAoVivo } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Última posição, jornada e visitas de hoje de cada vendedor.
export const mapaAoVivoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    mapaAoVivo({ organizationId: context.org.id, gestor: context.vendedor }),
  );
