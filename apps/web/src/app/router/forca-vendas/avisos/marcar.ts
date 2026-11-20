import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { marcarAviso } from "@/features/forca-vendas/server/avisos";
import { z } from "zod";

// Visualizou ou confirmou ("Li e entendi") um aviso.
export const marcarAvisoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      avisoId: z.string().min(1),
      acao: z.enum(["VISUALIZAR", "CONFIRMAR"]),
    }),
  )
  .handler(async ({ input, context }) => {
    await marcarAviso({
      organizationId: context.org.id,
      memberId: context.vendedor.memberId,
      ...input,
    });
    return { ok: true };
  });
