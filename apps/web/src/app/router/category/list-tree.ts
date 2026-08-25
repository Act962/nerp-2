import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Estrutura mercadológica completa e PLANA, com level/path — diferente de
// `categories.list`, que devolve só 2 níveis aninhados e é consumida pela tela
// de produtos. Aqui o cliente monta a árvore que quiser (o filtro em cascata
// Categoria > Sub-Categoria > Segmento > Sub-Segmento do planograma).
export const listCategoryTree = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // Só os descendentes deste nó — usa o materialized path, sem recursão.
      underId: z.string().optional(),
      maxLevel: z.number().int().min(0).max(9).optional(),
      onlyActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    let pathPrefix: string | undefined;
    if (input.underId) {
      const root = await prisma.category.findFirst({
        where: { id: input.underId, organizationId: context.org.id },
        select: { path: true, id: true },
      });
      // `path` pode ser null se o backfill não rodou; cai no id, que é o
      // primeiro segmento de qualquer path.
      pathPrefix = root ? (root.path ?? root.id) : "__inexistente__";
    }

    const categories = await prisma.category.findMany({
      where: {
        organizationId: context.org.id,
        isActive: input.onlyActive ? true : undefined,
        level: input.maxLevel != null ? { lte: input.maxLevel } : undefined,
        ...(pathPrefix ? { path: { startsWith: pathPrefix } } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        level: true,
        path: true,
        isActive: true,
        _count: { select: { products: true } },
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        level: category.level,
        path: category.path,
        isActive: category.isActive,
        productsCount: category._count.products,
      })),
    };
  });
