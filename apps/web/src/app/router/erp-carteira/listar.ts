import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  listarCarteiraDoWinthor,
  MAX_CLIENTES_POR_PAGINA,
} from "@/features/erp-carteira/server/carteira-winthor";
import { requireOrgAdmin } from "../erp-sync/_access";

/**
 * Página da carteira de clientes do Winthor. Chamada pelo Órbita (chave S2S com
 * `customer:rw`) para importar os clientes como leads; pela tela, só admin.
 */
export const listarCarteira = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      cursor: z.string().regex(/^\d+$/).nullish(),
      desde: z.coerce.date().nullish(),
      limite: z
        .number()
        .int()
        .min(1)
        .max(MAX_CLIENTES_POR_PAGINA)
        .default(MAX_CLIENTES_POR_PAGINA),
    }),
  )
  .handler(async ({ context, input }) => {
    if (!context.isS2S) await requireOrgAdmin(context.org.id, context.user.id);
    return listarCarteiraDoWinthor({
      organizationId: context.org.id,
      cursor: input.cursor ?? null,
      desde: input.desde ?? null,
      limite: input.limite,
    });
  });
