import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { listarPedidos } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Pedidos do vendedor (ou da equipe, quando o supervisor desliga "só os meus").
export const listarPedidosFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      status: z
        .enum([
          "ABERTOS",
          "DRAFT",
          "PENDING_APPROVAL",
          "CONFIRMED",
          "COMPLETED",
          "CANCELLED",
        ])
        .nullish(),
      customerId: z.string().nullish(),
      apenasMeus: z.boolean().default(true),
      cursor: z.string().nullish(),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input, context }) =>
    listarPedidos({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      status: input.status ?? undefined,
      customerId: input.customerId,
      apenasMeus: input.apenasMeus,
      cursor: input.cursor,
      limite: input.limite,
    }),
  );
