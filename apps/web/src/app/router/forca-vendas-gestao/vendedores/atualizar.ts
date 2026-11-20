import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { atualizarVendedor } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Licença, código no ERP e limites próprios do vendedor.
export const atualizarVendedorGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      memberId: z.string().min(1),
      ativo: z.boolean(),
      codigo: z.string().max(40).nullish(),
      descontoMaximoPercent: z.number().min(0).max(100).nullish(),
      flexLimiteNegativo: z.number().min(0).nullish(),
    }),
  )
  .handler(async ({ input, context }) => {
    await atualizarVendedor({
      organizationId: context.org.id,
      gestor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
