import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { removerDoRoteiro } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Tira um cliente do roteiro.
export const removerDoRoteiroFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ roteiroId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await removerDoRoteiro({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      roteiroId: input.roteiroId,
    });
    return { ok: true };
  });
