import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { adicionarAoRoteiro } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Põe um cliente da carteira no roteiro de um dia.
export const adicionarAoRoteiroFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      customerId: z.string().min(1),
      diaSemana: z.number().int().min(0).max(6),
    }),
  )
  .handler(async ({ input, context }) => {
    await adicionarAoRoteiro({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
