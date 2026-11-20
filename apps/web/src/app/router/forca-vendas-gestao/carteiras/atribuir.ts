import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { atribuirCarteira } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Põe clientes (ou uma cidade inteira) na carteira do vendedor.
export const atribuirCarteiraGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      memberId: z.string().min(1),
      customerIds: z.array(z.string().min(1)).max(1000).default([]),
      cidade: z.string().nullish(),
    }),
  )
  .handler(async ({ input, context }) =>
    atribuirCarteira({
      organizationId: context.org.id,
      gestor: context.vendedor,
      ...input,
    }),
  );
