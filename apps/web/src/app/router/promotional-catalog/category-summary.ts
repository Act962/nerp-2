import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { productFilterSchema, productFilterWhere } from "./_product-filters";

// Rótulo do balde de produtos sem categoria. `id`/`slug` nulos distinguem do
// caso "categoria chamada Sem categoria" cadastrada de verdade.
export const UNCATEGORIZED_LABEL = "Sem categoria";

// Quantos produtos ATIVOS cada categoria tem, e quantos deles ainda NÃO estão
// no catálogo. Alimenta a lista do diálogo "Adicionar por categoria".
//
// POST porque `excludeIds` carrega os produtos já no catálogo — num catálogo
// grande passa de 5 mil ids, que não cabem em query string.
export const catalogCategorySummary = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Contagem de produtos por categoria (dentro/fora do catálogo)",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      excludeIds: z.array(z.string()).default([]),
      // Mesmos filtros da aba de busca — sem isto, "restam 80" contaria
      // produtos que a busca esconde, e as duas abas voltariam a discordar.
      filters: productFilterSchema,
    }),
  )
  .output(
    z.array(
      z.object({
        // null = balde "Sem categoria".
        id: z.string().nullable(),
        slug: z.string().nullable(),
        name: z.string(),
        total: z.number(),
        remaining: z.number(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    // Sem filtros, mantém o comportamento anterior (só ativos).
    const orgWhere = {
      organizationId: context.org.id,
      ...(input.filters
        ? productFilterWhere(input.filters)
        : { isActive: true }),
    };

    const [totals, remaining, categories] = await Promise.all([
      prisma.product.groupBy({
        by: ["categoryId"],
        where: orgWhere,
        _count: { _all: true },
      }),
      prisma.product.groupBy({
        by: ["categoryId"],
        where:
          input.excludeIds.length > 0
            ? { ...orgWhere, id: { notIn: input.excludeIds } }
            : orgWhere,
        _count: { _all: true },
      }),
      prisma.category.findMany({
        where: { organizationId: context.org.id },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const totalBy = new Map(totals.map((r) => [r.categoryId, r._count._all]));
    const remainingBy = new Map(
      remaining.map((r) => [r.categoryId, r._count._all]),
    );

    type Row = {
      id: string | null;
      slug: string | null;
      name: string;
      total: number;
      remaining: number;
    };

    const rows: Row[] = categories
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        total: totalBy.get(c.id) ?? 0,
        remaining: remainingBy.get(c.id) ?? 0,
      }))
      // Categoria sem nenhum produto ativo não ajuda em nada na lista.
      .filter((c) => c.total > 0);

    const semCategoria = totalBy.get(null) ?? 0;
    if (semCategoria > 0) {
      rows.push({
        id: null,
        slug: null,
        name: UNCATEGORIZED_LABEL,
        total: semCategoria,
        remaining: remainingBy.get(null) ?? 0,
      });
    }

    return rows;
  });
