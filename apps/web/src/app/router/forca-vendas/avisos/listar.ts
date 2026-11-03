import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { avisosDoVendedor } from "@/features/forca-vendas/server/avisos";
import { z } from "zod";

// Avisos vigentes do gestor para o vendedor.
export const listarAvisosFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) =>
    avisosDoVendedor({
      organizationId: context.org.id,
      memberId: context.vendedor.memberId,
    }),
  );
