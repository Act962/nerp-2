import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { naoLidasDaCarteira } from "@/features/forca-vendas/server/mensagens";
import { z } from "zod";

// Mensagens não lidas da carteira (badge da home).
export const naoLidasFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => ({
    total: await naoLidasDaCarteira({
      organizationId: context.org.id,
      vendedor: context.vendedor,
    }),
  }));
