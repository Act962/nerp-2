import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { listarConversas } from "@/features/forca-vendas/server/mensagens";
import { z } from "zod";

// Conversas do WhatsApp oficial da carteira do vendedor.
export const listarConversasFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      busca: z.string().trim().nullish(),
      cursor: z.string().nullish(),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input, context }) =>
    listarConversas({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      ...input,
    }),
  );
