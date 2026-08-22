import prisma from "@/lib/db";

// Resolve os produtos de um Catálogo Promocional a partir da config, por org.
// Usado pela procedure autenticada (list-promotional-products) e pela pública
// (public-get, via link). Multi-tenant SEMPRE por `organizationId`.

export type ResolveParams = {
  excludedIds?: string[];
  manuallyAddedIds?: string[];
  categoryFilter?: string[];
  autoPromotions?: boolean;
  name?: string;
  sortBy?:
    | "discount-desc"
    | "price-asc"
    | "price-desc"
    | "name-asc"
    | "savings-desc";
};

export type ResolvedProduct = {
  id: string;
  name: string;
  sku: string;
  thumbnail: string;
  salePrice: number;
  promotionalPrice: number | null;
  discount: number | null;
  savings: number | null;
  categoryName: string | null;
  currentStock: number;
  description: string | null;
  unit: string;
};

export async function resolvePromotionalProducts(
  organizationId: string,
  params: ResolveParams,
): Promise<ResolvedProduct[]> {
  const excludedIds = params.excludedIds ?? [];
  const manuallyAddedIds = params.manuallyAddedIds ?? [];
  const categoryFilter = params.categoryFilter ?? [];
  const includeAuto =
    params.autoPromotions === true || categoryFilter.length > 0;

  const products = await prisma.product.findMany({
    where: {
      organizationId,
      OR: [
        ...(includeAuto
          ? [
              {
                isActive: true,
                promotionalPrice: { not: null },
                NOT: { id: { in: excludedIds } },
                ...(categoryFilter.length > 0 && {
                  category: { slug: { in: categoryFilter } },
                }),
              },
            ]
          : []),
        ...(manuallyAddedIds.length > 0
          ? [{ id: { in: manuallyAddedIds } }]
          : []),
      ],
      ...(params.name && {
        name: { contains: params.name, mode: "insensitive" as const },
      }),
    },
    include: {
      category: { select: { name: true } },
    },
  });

  const result: ResolvedProduct[] = products.map((p) => {
    const salePrice = p.salePrice.toNumber();
    const promotionalPrice = p.promotionalPrice
      ? p.promotionalPrice.toNumber()
      : null;
    const discount =
      promotionalPrice !== null && salePrice > 0
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
      unit: p.unit,
    };
  });

  const sortBy = params.sortBy ?? "discount-desc";
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
}
