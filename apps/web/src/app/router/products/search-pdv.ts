import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Busca da grade do PDV.
 *
 * Procedure própria, e não `products.list`, por duas razões que não cabiam lá:
 *
 * 1. **Paginação por página, não por cursor.** O operador precisa saber quantos
 *    produtos casaram e alcançar qualquer página — "página 3 de 7 · 61
 *    produtos". Cursor só sabe avançar e voltar um passo.
 * 2. **Quem COMEÇA com o termo vem primeiro.** Buscando "queijo", o operador
 *    espera os "Queijo ..." antes de "Pão de queijo". Em ordem alfabética pura
 *    o "Pão" vem antes, e a página 1 fica cheia do que ele não procurava.
 *
 * `products.list` continua servindo a tela de Produtos e o catálogo, intocada.
 */

const SELECT = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  salePrice: true,
  promotionalPrice: true,
  costPrice: true,
  currentStock: true,
  minStock: true,
  maxStock: true,
  unit: true,
  thumbnail: true,
  isActive: true,
  trackStock: true,
} satisfies Prisma.ProductSelect;

const ORDER_BY: Prisma.ProductOrderByWithRelationInput[] = [
  { name: "asc" },
  // Fecha a ordenação: sem um campo único, o `skip`/`take` pode repetir ou
  // pular linha entre uma página e outra.
  { id: "desc" },
];

type Row = Prisma.ProductGetPayload<{ select: typeof SELECT }>;

function toProduct(product: Row) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    salePrice: product.salePrice.toNumber(),
    promotionalPrice: product.promotionalPrice?.toNumber() ?? null,
    costPrice: product.costPrice.toNumber(),
    currentStock: product.currentStock.toNumber(),
    minStock: product.minStock.toNumber(),
    maxStock: product.maxStock?.toNumber(),
    unit: product.unit,
    image: product.thumbnail ?? "",
    isActive: product.isActive,
    trackStock: product.trackStock,
  };
}

export const searchProductsForPdv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      search: z.string().optional(),
      /** Slug da categoria da aba. Ausente = todas. */
      categorySlug: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(60).default(9),
    }),
  )
  .output(
    z.object({
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          sku: z.string(),
          barcode: z.string(),
          salePrice: z.number(),
          promotionalPrice: z.number().nullable(),
          costPrice: z.number(),
          currentStock: z.number(),
          minStock: z.number(),
          maxStock: z.number().optional(),
          unit: z.string(),
          image: z.string(),
          isActive: z.boolean(),
          trackStock: z.boolean(),
        }),
      ),
      totalCount: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const search = input.search?.trim();
    const skip = (input.page - 1) * input.pageSize;

    const scope: Prisma.ProductWhereInput = {
      organizationId: context.org.id,
      ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
    };

    const paginado = (totalCount: number, products: Row[]) => ({
      products: products.map(toProduct),
      totalCount,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / input.pageSize)),
    });

    if (!search) {
      const [rows, totalCount] = await Promise.all([
        prisma.product.findMany({
          where: scope,
          orderBy: ORDER_BY,
          skip,
          take: input.pageSize,
          select: SELECT,
        }),
        prisma.product.count({ where: scope }),
      ]);
      return paginado(totalCount, rows);
    }

    // Dois baldes: primeiro quem COMEÇA com o termo, depois todo o resto que
    // apenas o contém (no nome, no SKU ou no código de barras).
    const comecaCom: Prisma.ProductWhereInput = {
      name: { startsWith: search, mode: "insensitive" },
    };
    const wherePrefixo: Prisma.ProductWhereInput = { ...scope, ...comecaCom };
    const whereResto: Prisma.ProductWhereInput = {
      ...scope,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search } },
      ],
      NOT: comecaCom,
    };

    const [totalPrefixo, totalResto] = await Promise.all([
      prisma.product.count({ where: wherePrefixo }),
      prisma.product.count({ where: whereResto }),
    ]);

    // Quantos desta página saem de cada balde. A página de transição pega o
    // fim do primeiro e o começo do segundo.
    const doPrefixo = Math.min(
      input.pageSize,
      Math.max(0, totalPrefixo - skip),
    );
    const doResto = input.pageSize - doPrefixo;

    const [linhasPrefixo, linhasResto] = await Promise.all([
      doPrefixo > 0
        ? prisma.product.findMany({
            where: wherePrefixo,
            orderBy: ORDER_BY,
            skip,
            take: doPrefixo,
            select: SELECT,
          })
        : Promise.resolve([]),
      doResto > 0
        ? prisma.product.findMany({
            where: whereResto,
            orderBy: ORDER_BY,
            skip: Math.max(0, skip - totalPrefixo),
            take: doResto,
            select: SELECT,
          })
        : Promise.resolve([]),
    ]);

    return paginado(totalPrefixo + totalResto, [
      ...linhasPrefixo,
      ...linhasResto,
    ]);
  });
