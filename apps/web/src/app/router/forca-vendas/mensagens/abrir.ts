import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { exigirConversaDoVendedor } from "@/features/forca-vendas/server/mensagens";
import { z } from "zod";

// Cabeçalho da conversa, conferindo que ela é da carteira do vendedor.
export const abrirConversaFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ conversationId: z.string().min(1) }))
  .handler(async ({ input, context }) =>
    exigirConversaDoVendedor({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      conversationId: input.conversationId,
    }),
  );
