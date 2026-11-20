import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireGestorFvMiddleware } from "@/app/middlewares/vendedor";
import { ajustarFlex } from "@/features/forca-vendas/server/gestao";
import { z } from "zod";

// Crédito ou débito manual no flex, com lançamento no extrato.
export const ajustarFlexGestao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireGestorFvMiddleware)
  .input(
    z.object({
      memberId: z.string().min(1),
      valor: z
        .number()
        .refine((valor) => valor !== 0, "Informe um valor diferente de zero"),
      descricao: z.string().trim().min(3, "Explique o ajuste").max(200),
    }),
  )
  .handler(async ({ input, context }) => {
    await ajustarFlex({
      organizationId: context.org.id,
      gestor: context.vendedor,
      ...input,
    });
    return { ok: true };
  });
