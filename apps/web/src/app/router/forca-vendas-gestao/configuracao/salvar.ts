import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { salvarConfiguracao } from "@/features/forca-vendas/server/gestao";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

// Salva a política comercial.
export const salvarConfiguracaoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      descontoLivrePercent: z.number().min(0).max(100),
      descontoMaximoPercent: z.number().min(0).max(100),
      flexCreditoPercent: z.number().min(0).max(100),
      flexLimiteNegativo: z.number().min(0),
      autoAprovar: z.boolean(),
      bloquearInadimplente: z.boolean(),
      raioCheckinMetros: z.number().int().min(20).max(5000),
      retencaoLocalizacaoDias: z.number().int().min(7).max(730),
      destinoPedido: z.enum(["NATIVO", "WINTHOR"]),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!context.vendedor.podeAprovar) {
      throw new ORPCError("FORBIDDEN", {
        message: "Só quem aprova pedidos muda a política comercial",
      });
    }
    await salvarConfiguracao({ organizationId: context.org.id, ...input });
    return { ok: true };
  });
