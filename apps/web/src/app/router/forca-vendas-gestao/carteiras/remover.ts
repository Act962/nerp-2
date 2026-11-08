import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { removerDaCarteira } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Tira clientes da carteira do vendedor.
export const removerDaCarteiraGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      memberId: z.string().min(1),
      customerIds: z.array(z.string().min(1)).min(1).max(1000),
    }),
  )
  .handler(async ({ input, context }) =>
    removerDaCarteira({
      organizationId: context.org.id,
      gestor: context.vendedor,
      ...input,
    }),
  );
