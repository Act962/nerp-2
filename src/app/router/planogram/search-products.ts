import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Seletor de produto do editor. Procedure própria e NÃO `products.list` porque
// aquela faz um `count` com ILIKE '%termo%' em toda chamada — em 400 mil SKUs
// isso é sequential scan a cada tecla digitada. Aqui: cursor puro, sem count,
// payload enxuto, e o índice trigram (products_name_trgm_idx) faz o resto.

const PAGE_SIZE = 30;
/** Abaixo disso a busca textual traz ruído demais para valer a query. */
const MIN_QUERY_LENGTH = 2;
/** EAN-8 é o menor código de barras real. */
const MIN_BARCODE_LENGTH = 8;

export const searchPlanogramProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      q: z.string().optional(),
      categoryId: z.string().optional(),
      brandId: z.string().optional(),
      /** Sem medida o produto não pode ser posicionado sem antes ser medido. */
      onlyWithDimensions: z.boolean().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(60).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const limit = input.limit ?? PAGE_SIZE;
    const query = input.q?.trim() ?? "";

    // Só dígitos e comprimento de código de barras → busca exata pelo índice
    // único (organizationId, barcode). É instantânea e é o caso mais comum de
    // quem está com o produto na mão, lendo o EAN.
    const isBarcodeLookup =
      query.length >= MIN_BARCODE_LENGTH && /^\d+$/.test(query);

    const where = {
      organizationId: context.org.id,
      isActive: true,
      categoryId: input.categoryId,
      brandId: input.brandId,
      ...(input.onlyWithDimensions
        ? { widthMm: { not: null }, heightMm: { not: null } }
        : {}),
      ...(isBarcodeLookup
        ? { barcode: query }
        : query.length >= MIN_QUERY_LENGTH
          ? { name: { contains: query, mode: "insensitive" as const } }
          : {}),
    };

    const rows = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        barcode: true,
        thumbnail: true,
        widthMm: true,
        heightMm: true,
        depthMm: true,
        packWidthMm: true,
        packHeightMm: true,
        packDepthMm: true,
        brandId: true,
        categoryId: true,
        supplierId: true,
        brand: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      products: items.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        thumbnail: product.thumbnail || null,
        brandId: product.brandId,
        brandName: product.brand?.name ?? null,
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        widthMm: product.widthMm,
        heightMm: product.heightMm,
        depthMm: product.depthMm,
        packWidthMm: product.packWidthMm,
        packHeightMm: product.packHeightMm,
        packDepthMm: product.packDepthMm,
      })),
      // Sem totalCount de propósito: contar 400k por tecla é o que queremos evitar.
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  });
