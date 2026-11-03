import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { clientesParaCarteira } from "@/features/forca-vendas/server/gestao";
import { membroNoEscopo } from "@/features/forca-vendas/server/escopo-equipe";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

// Clientes para montar a carteira de um vendedor.
export const clientesParaCarteiraGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      memberId: z.string().min(1),
      busca: z.string().trim().nullish(),
      cidade: z.string().nullish(),
      situacao: z
        .enum(["DA_CARTEIRA", "SEM_CARTEIRA", "TODOS"])
        .default("DA_CARTEIRA"),
      cursor: z.string().nullish(),
      limite: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!membroNoEscopo(context.vendedor.escopo, input.memberId)) {
      throw new ORPCError("NOT_FOUND", { message: "Vendedor não encontrado" });
    }
    return clientesParaCarteira({ organizationId: context.org.id, ...input });
  });
