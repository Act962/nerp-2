import prisma from "@/lib/db";
import {
  productFilterSchema,
  productFilterWhere,
} from "../promotional-catalog/_product-filters";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const listProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar todos os produtos",
    tags: ["products"],
  })
  .input(
    z.object({
      category: z.array(z.string()).optional(),
      name: z.string().optional(),
      sku: z.string().optional(),
      // Busca única (PDV): casa nome OU sku OU código de barras.
      search: z.string().optional(),
      minValue: z.string().optional(),
      maxValue: z.string().optional(),
      dateInit: z.date().optional(),
      dateEnd: z.date().optional(),
      cursor: z.string().optional(),
      limit: z.number(),
      // Filtros do diálogo do Catálogo Promocional. TODOS opcionais e SEM
      // default aqui: quem não manda nada recebe o mesmo resultado de sempre.
      // Um default de "só ativos" no servidor esconderia inativos da tela de
      // Produtos, que usa esta mesma procedure.
      filters: productFilterSchema,
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
          category: z.string(),
          salePrice: z.number(),
          costPrice: z.number(),
          currentStock: z.number(),
          minStock: z.number(),
          maxStock: z.number().optional(),
          // Unidade cadastrada (UN, KG, G, L, ML, M, M2, M3, CX, PC, PAR, DZ).
          // Enviada como string para o cliente traduzir em rótulo pt-BR.
          unit: z.string(),
          image: z.string(),
          isActive: z.boolean(),
          trackStock: z.boolean(),
        }),
      ),
      totalCount: z.number(),
      nextCursor: z.string().nullable(),
      hasNextPage: z.boolean(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { limit } = input;

    try {
      const where = {
        organizationId: context.org.id,
        ...productFilterWhere(input.filters),
        ...(input.category && {
          category: {
            slug: {
              in: input.category,
            },
          },
        }),
        ...(input.name && {
          name: {
            contains: input.name,
            mode: "insensitive" as const,
          },
        }),
        ...(input.sku && {
          sku: {
            contains: input.sku,
          },
        }),
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { sku: { contains: input.search, mode: "insensitive" as const } },
            { barcode: { contains: input.search } },
          ],
        }),
        ...(input.minValue && {
          salePrice: {
            gte: Number(input.minValue) / 100,
          },
        }),
        ...(input.maxValue && {
          salePrice: {
            lte: Number(input.maxValue) / 100,
          },
        }),
        ...(input.dateInit &&
          input.dateEnd && {
            createdAt: {
              gte: input.dateInit,
              lte: input.dateEnd,
            },
          }),
      };

      const [products, totalCount] = await Promise.all([
        prisma.product.findMany({
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            category: {
              select: {
                name: true,
              },
            },
            salePrice: true,
            costPrice: true,
            currentStock: true,
            minStock: true,
            maxStock: true,
            unit: true,
            images: true,
            isActive: true,
            trackStock: true,
            thumbnail: true,
          },
          // Busca um item extra para saber se há próxima página.
          take: limit + 1,
          ...(input.cursor && {
            cursor: { id: input.cursor },
            skip: 1,
          }),
          orderBy: [{ name: "asc" }, { id: "desc" }],
          where,
        }),
        prisma.product.count({ where }),
      ]);

      const hasNextPage = products.length > limit;
      const items = hasNextPage ? products.slice(0, limit) : products;
      const nextCursor = hasNextPage ? items[items.length - 1].id : null;

      const productList = items.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku ?? "",
        barcode: product.barcode ?? "",
        category: product.category?.name ?? "",
        salePrice: product.salePrice.toNumber(),
        costPrice: product.costPrice.toNumber(),
        currentStock: product.currentStock.toNumber(),
        minStock: product.minStock.toNumber(),
        maxStock: product.maxStock?.toNumber(),
        unit: product.unit,
        image: product.thumbnail ?? "",
        isActive: product.isActive,
        trackStock: product.trackStock,
      }));

      return {
        products: productList,
        totalCount,
        nextCursor,
        hasNextPage,
      };
    } catch (error) {
      throw error;
    }
  });
