import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Aplica um patch simples (isActive / trackStock / showInCatalog) em vários
// produtos de uma vez. Dois modos:
//   - `productIds`: lista explícita (checkboxes marcados na tabela).
//   - `all: true`: aplica em TODOS os produtos que casam com o filtro
//     opcional (`categorySlugs`, `search`) — para "aplicar em todos os
//     produtos filtrados". O filtro reflete o que o usuário está vendo.
//
// Multi-tenant: sempre `organizationId: context.org.id`. Nenhum id da
// entrada é usado sem passar por esse escopo.
export const bulkUpdateProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        productIds: z.array(z.string()).optional(),
        all: z.boolean().optional(),
        filter: z
          .object({
            categorySlugs: z.array(z.string()).optional(),
            search: z.string().optional(),
          })
          .optional(),
        patch: z.object({
          isActive: z.boolean().optional(),
          trackStock: z.boolean().optional(),
          showInCatalog: z.boolean().optional(),
        }),
      })
      .refine(
        (v) =>
          (v.productIds && v.productIds.length > 0) || v.all === true,
        {
          message: "Informe productIds ou all: true",
        },
      )
      .refine((v) => Object.keys(v.patch).length > 0, {
        message: "Informe pelo menos um campo em patch",
      }),
  )
  .output(z.object({ updated: z.number() }))
  .handler(async ({ input, context }) => {
    const orgWhere = { organizationId: context.org.id };

    if (input.productIds && input.productIds.length > 0 && !input.all) {
      const result = await prisma.product.updateMany({
        where: {
          ...orgWhere,
          id: { in: input.productIds },
        },
        data: input.patch,
      });
      return { updated: result.count };
    }

    // all: true — respeita o mesmo filtro visível na tabela.
    const filter = input.filter ?? {};
    const result = await prisma.product.updateMany({
      where: {
        ...orgWhere,
        ...(filter.categorySlugs && filter.categorySlugs.length > 0
          ? { category: { slug: { in: filter.categorySlugs } } }
          : {}),
        ...(filter.search
          ? {
              OR: [
                {
                  name: {
                    contains: filter.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  sku: {
                    contains: filter.search,
                    mode: "insensitive" as const,
                  },
                },
                { barcode: { contains: filter.search } },
              ],
            }
          : {}),
      },
      data: input.patch,
    });
    return { updated: result.count };
  });
