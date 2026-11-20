import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { listarPedidos } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Receptor: os pedidos da Força de Vendas no escopo do gestor.
export const listarPedidosGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
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
      memberId: z.string().nullish(),
      cursor: z.string().nullish(),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input, context }) =>
    listarPedidos({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      status: input.status ?? undefined,
      memberId: input.memberId,
      cursor: input.cursor,
      limite: input.limite,
    }),
  );
