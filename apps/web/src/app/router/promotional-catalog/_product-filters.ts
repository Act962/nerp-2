import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

// Filtros de produto do diálogo "Adicionar produto ao catálogo".
//
// Contrato ÚNICO, consumido por três procedures: `products.list` (aba de
// busca), `categorySummary` e `categoryAvailableIds` (aba por categoria). As
// duas abas do mesmo diálogo precisam concordar sobre o que existe — antes a
// busca trazia produto inativo e a aba de categoria não, então o "restam 80"
// contava uma coisa e a busca mostrava outra.

export const productFilterSchema = z
  .object({
    // Só produtos ativos no ERP. É decisão do CLIENTE (o diálogo manda `true`),
    // NUNCA um default de servidor: a tela de Produtos usa a mesma procedure e
    // ali ver o inativo é justamente o ponto.
    onlyActive: z.boolean().optional(),
    // Com foto cadastrada. `thumbnail` é o campo certo: é dele que saem tanto a
    // listagem (`products/list.ts`) quanto o card do catálogo
    // (`server/resolve-products.ts`) — filtrar por `images` diria uma coisa e o
    // card mostraria outra.
    withImage: z.boolean().optional(),
    withPromotion: z.boolean().optional(),
    // Visível no Catálogo Online. Campo SEPARADO do `isActive`: um produto pode
    // estar ativo no ERP e oculto do catálogo online, e vice-versa.
    inOnlineCatalog: z.boolean().optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
  })
  .optional();

export type ProductFilters = z.infer<typeof productFilterSchema>;

/**
 * Fragmento de `where` do Prisma para os filtros.
 *
 * Sem filtros devolve `{}` — nada é filtrado, que é o que mantém os chamadores
 * antigos intactos.
 */
export function productFilterWhere(
  filters: ProductFilters,
): Prisma.ProductWhereInput {
  if (!filters) return {};
  const where: Prisma.ProductWhereInput = {};

  if (filters.onlyActive) where.isActive = true;
  if (filters.inOnlineCatalog) where.showInCatalog = true;
  // `thumbnail` tem default "" no schema, então "sem foto" é string vazia — não
  // `null`.
  if (filters.withImage) where.thumbnail = { not: "" };
  if (filters.withPromotion) where.promotionalPrice = { not: null };

  const { minPrice, maxPrice } = filters;
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.salePrice = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }

  return where;
}

/** Quantos filtros estão ligados — o diálogo usa para o contador do botão. */
export function activeFilterCount(filters: ProductFilters): number {
  if (!filters) return 0;
  return (
    (filters.onlyActive ? 1 : 0) +
    (filters.withImage ? 1 : 0) +
    (filters.withPromotion ? 1 : 0) +
    (filters.inOnlineCatalog ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0)
  );
}
