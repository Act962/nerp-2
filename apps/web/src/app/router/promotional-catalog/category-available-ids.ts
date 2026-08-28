import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { assertCanEditCatalog } from "./_require-edit";
import { UNCATEGORIZED_LABEL } from "./category-summary";
import { productFilterSchema, productFilterWhere } from "./_product-filters";

// Ids dos produtos que ainda cabem no catálogo, AGRUPADOS por categoria.
//
// A saída vem agrupada (e não numa lista só) porque o cliente monta uma página
// por categoria: sem o agrupamento ele teria que descobrir a categoria de cada
// id numa segunda ida ao servidor.
//
// Ordem alfabética por nome — a mesma da listagem do ERP, então aplicar em
// lotes é previsível: o dev sempre sabe onde parou.
export const catalogCategoryAvailableIds = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Ids disponíveis por categoria, para aplicar no catálogo",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      // Slugs das categorias pedidas, na ordem em que devem ser aplicadas.
      // `null` DENTRO do array = o balde "Sem categoria". O array inteiro
      // `null` = todas as categorias.
      keys: z.array(z.string().nullable()).nullable(),
      excludeIds: z.array(z.string()).default([]),
      // Ausente = tudo o que restar. Presente = teto POR categoria.
      limit: z.number().int().positive().optional(),
      // Idem `categorySummary`: aplicar produto tem que respeitar o mesmo
      // filtro que contou o "restam N".
      filters: productFilterSchema,
    }),
  )
  .output(
    z.object({
      groups: z.array(
        z.object({
          id: z.string().nullable(),
          name: z.string(),
          ids: z.array(z.string()),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await assertCanEditCatalog(context.org.id, context.user.id, errors);

    const categories = await prisma.category.findMany({
      where: { organizationId: context.org.id },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    const bySlug = new Map(categories.map((c) => [c.slug, c]));

    // Categorias pedidas, na ordem pedida. Slug desconhecido é ignorado em
    // silêncio: a lista do cliente pode ter envelhecido (categoria renomeada
    // ou apagada por outro usuário), e derrubar a operação inteira por isso
    // seria pior do que aplicar o resto.
    const requested: { id: string | null; name: string }[] =
      input.keys === null
        ? [
            ...categories.map((c) => ({ id: c.id, name: c.name })),
            { id: null, name: UNCATEGORIZED_LABEL },
          ]
        : input.keys.flatMap((key): { id: string | null; name: string }[] => {
            if (key === null) return [{ id: null, name: UNCATEGORIZED_LABEL }];
            const hit = bySlug.get(key);
            return hit ? [{ id: hit.id, name: hit.name }] : [];
          });

    if (requested.length === 0) return { groups: [] };

    const wantsUncategorized = requested.some((r) => r.id === null);
    const wantedIds = requested
      .map((r) => r.id)
      .filter((id): id is string => id !== null);

    // Uma query só, agrupada no servidor Node em vez de N queries: o `orderBy`
    // por nome já entrega a ordem final de cada balde.
    const rows = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.filters
          ? productFilterWhere(input.filters)
          : { isActive: true }),
        ...(input.excludeIds.length > 0 && {
          id: { notIn: input.excludeIds },
        }),
        ...(input.keys !== null && {
          OR: [
            ...(wantedIds.length > 0
              ? [{ categoryId: { in: wantedIds } }]
              : []),
            ...(wantsUncategorized ? [{ categoryId: null }] : []),
          ],
        }),
      },
      select: { id: true, categoryId: true },
      orderBy: { name: "asc" },
    });

    const buckets = new Map<string | null, string[]>();
    for (const row of rows) {
      const key = row.categoryId;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row.id);
      else buckets.set(key, [row.id]);
    }

    const groups = requested
      .map((r) => {
        const ids = buckets.get(r.id) ?? [];
        return {
          id: r.id,
          name: r.name,
          ids: input.limit ? ids.slice(0, input.limit) : ids,
        };
      })
      .filter((g) => g.ids.length > 0);

    return { groups };
  });
