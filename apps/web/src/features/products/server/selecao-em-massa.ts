import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

/**
 * "Quais produtos" das ações em massa da tabela: os marcados (`productIds`) ou
 * todos os que casam com o filtro visível (`all: true` + `filter`). Sempre
 * dentro da organização — nenhum id da entrada é usado sem esse escopo.
 */
export const selecaoEmMassaShape = {
  productIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
  filter: z
    .object({
      categorySlugs: z.array(z.string()).optional(),
      search: z.string().optional(),
    })
    .optional(),
};

export const selecaoEmMassaValida = (selecao: {
  productIds?: string[];
  all?: boolean;
}) =>
  (selecao.productIds && selecao.productIds.length > 0) || selecao.all === true;

export function whereDaSelecao(
  organizationId: string,
  selecao: {
    productIds?: string[];
    all?: boolean;
    filter?: { categorySlugs?: string[]; search?: string };
  },
): Prisma.ProductWhereInput {
  if (selecao.productIds && selecao.productIds.length > 0 && !selecao.all) {
    return { organizationId, id: { in: selecao.productIds } };
  }
  const filter = selecao.filter ?? {};
  return {
    organizationId,
    ...(filter.categorySlugs && filter.categorySlugs.length > 0
      ? { category: { slug: { in: filter.categorySlugs } } }
      : {}),
    ...(filter.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: "insensitive" as const } },
            { sku: { contains: filter.search, mode: "insensitive" as const } },
            { barcode: { contains: filter.search } },
          ],
        }
      : {}),
  };
}
