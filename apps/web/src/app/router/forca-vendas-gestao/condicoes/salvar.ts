import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { salvarCondicao } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Cria ou edita uma condição de pagamento.
export const salvarCondicaoGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      id: z.string().nullish(),
      nome: z.string().trim().min(2, "Dê um nome à condição").max(60),
      prazosDias: z.array(z.number().int().min(0).max(365)).max(12),
      formaPagamento: z.enum([
        "DINHEIRO",
        "PIX",
        "DEBITO",
        "CREDITO",
        "BOLETO",
        "TRANSFERENCIA",
        "OUTROS",
      ]),
      ativo: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) =>
    salvarCondicao({ organizationId: context.org.id, ...input }),
  );
