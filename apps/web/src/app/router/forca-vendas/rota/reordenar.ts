import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { reordenarRoteiro } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Nova ordem das paradas, como o vendedor arrumou.
export const reordenarRoteiroFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ roteiroIds: z.array(z.string().min(1)).max(200) }))
  .handler(async ({ input, context }) => {
    await reordenarRoteiro({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      roteiroIds: input.roteiroIds,
    });
    return { ok: true };
  });
