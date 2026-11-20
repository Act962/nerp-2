import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  selecaoEmMassaShape,
  selecaoEmMassaValida,
  whereDaSelecao,
} from "@/features/products/server/selecao-em-massa";
import prisma from "@/lib/db";

// Aplica um patch simples (isActive / trackStock / showInCatalog) em vários
// produtos de uma vez: os marcados na tabela ou todos os do filtro visível
// (ver `selecao-em-massa.ts`).
export const bulkUpdateProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        ...selecaoEmMassaShape,
        patch: z.object({
          isActive: z.boolean().optional(),
          trackStock: z.boolean().optional(),
          showInCatalog: z.boolean().optional(),
        }),
      })
      .refine(selecaoEmMassaValida, {
        message: "Informe productIds ou all: true",
      })
      .refine((v) => Object.keys(v.patch).length > 0, {
        message: "Informe pelo menos um campo em patch",
      }),
  )
  .output(z.object({ updated: z.number() }))
  .handler(async ({ input, context }) => {
    const result = await prisma.product.updateMany({
      where: whereDaSelecao(context.org.id, input),
      data: input.patch,
    });
    return { updated: result.count };
  });
