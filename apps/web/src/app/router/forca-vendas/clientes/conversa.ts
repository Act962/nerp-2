import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { conversaDoCliente } from "@/features/forca-vendas/server/mensagens";
import { z } from "zod";

// Conversa do cliente no WhatsApp oficial, se já existir.
export const conversaDoClienteFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ customerId: z.string().min(1) }))
  .handler(async ({ input, context }) => ({
    conversationId: await conversaDoCliente({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      customerId: input.customerId,
    }),
  }));
