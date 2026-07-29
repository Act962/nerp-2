import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const listPromotionalProducts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar produtos para catálogo promocional",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      excludedIds: z.array(z.string()).optional(),
      manuallyAddedIds: z.array(z.string()).optional(),
      categoryFilter: z.array(z.string()).optional(),
      name: z.string().optional(),
      sortBy: z
        .enum([
          "discount-desc",
          "price-asc",
          "price-desc",
          "name-asc",
          "savings-desc",
        ])
        .optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        sku: z.string(),
        thumbnail: z.string(),
        salePrice: z.number(),
        promotionalPrice: z.number().nullable(),
        discount: z.number().nullable(),
        savings: z.number().nullable(),
        categoryName: z.string().nullable(),
        currentStock: z.number(),
        description: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const excludedIds = input.excludedIds ?? [];
    const manuallyAddedIds = input.manuallyAddedIds ?? [];
    const categoryFilter = input.categoryFilter ?? [];

    const products = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        isActive: true,
        OR: [
          {
            promotionalPrice: { not: null },
            NOT: { id: { in: excludedIds } },
          },
          ...(manuallyAddedIds.length > 0
            ? [{ id: { in: manuallyAddedIds } }]
            : []),
        ],
        ...(categoryFilter.length > 0 && {
          category: { slug: { in: categoryFilter } },
        }),
        ...(input.name && {
          name: { contains: input.name, mode: "insensitive" as const },
        }),
      },
      include: {
        category: { select: { name: true } },
      },
    });

    const result = products.map((p) => {
      const salePrice = p.salePrice.toNumber();
      const promotionalPrice = p.promotionalPrice
        ? p.promotionalPrice.toNumber()
        : null;
      const discount =
        promotionalPrice !== null
          ? ((salePrice - promotionalPrice) / salePrice) * 100
          : null;
      const savings =
        promotionalPrice !== null ? salePrice - promotionalPrice : null;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku ?? "",
        thumbnail: p.thumbnail ?? "",
        salePrice,
        promotionalPrice,
        discount,
        savings,
        categoryName: p.category?.name ?? null,
        currentStock: p.currentStock.toNumber(),
        description: p.description,
      };
    });

    const sortBy = input.sortBy ?? "discount-desc";
    if (sortBy === "discount-desc") {
      result.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    } else if (sortBy === "savings-desc") {
      result.sort((a, b) => (b.savings ?? 0) - (a.savings ?? 0));
    } else if (sortBy === "price-asc") {
      result.sort(
        (a, b) =>
          (a.promotionalPrice ?? a.salePrice) -
          (b.promotionalPrice ?? b.salePrice),
      );
    } else if (sortBy === "price-desc") {
      result.sort(
        (a, b) =>
          (b.promotionalPrice ?? b.salePrice) -
          (a.promotionalPrice ?? a.salePrice),
      );
    } else if (sortBy === "name-asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  });
