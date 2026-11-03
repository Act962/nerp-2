import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { extratoFlex } from "@/features/forca-vendas/server/inicio";
import { membroNoEscopo } from "@/features/forca-vendas/server/escopo-equipe";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

// Extrato do flex de um vendedor.
export const extratoFlexGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(z.object({ memberId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    if (!membroNoEscopo(context.vendedor.escopo, input.memberId)) {
      throw new ORPCError("NOT_FOUND", { message: "Vendedor não encontrado" });
    }
    return extratoFlex({
      organizationId: context.org.id,
      memberId: input.memberId,
    });
  });
