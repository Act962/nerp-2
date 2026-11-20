import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { fazerCheckout } from "@/features/forca-vendas/server/campo";
import { z } from "zod";

// Encerra a visita com o resultado.
export const fazerCheckoutFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      visitaId: z.string().min(1),
      resultado: z.enum(["PEDIDO", "SEM_PEDIDO", "FECHADO", "AUSENTE"]),
      motivoSemPedido: z.string().max(300).nullish(),
      observacao: z.string().max(1000).nullish(),
      latitude: z.number().min(-90).max(90).nullish(),
      longitude: z.number().min(-180).max(180).nullish(),
    }),
  )
  .handler(async ({ input, context }) => {
    await fazerCheckout({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
