import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";

// Busca PÚBLICA do catálogo pelo token do link (sem auth). Resolve os produtos
// do lado do servidor (usando a org do catálogo) para a página pública render.
export const publicGetCatalog = base
  .route({
    method: "GET",
    summary: "Catálogo promocional público (por link)",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ shareToken: z.string().min(8) }))
  .output(
    z.object({
      name: z.string(),
      config: z.unknown(),
      products: z.array(
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
          unit: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const catalog = await prisma.promotionalCatalog.findFirst({
      where: { config: { path: ["shareToken"], equals: input.shareToken } },
    });
    if (!catalog) throw errors.NOT_FOUND();

    const config = (catalog.config as Record<string, unknown>) ?? {};
    const products = await resolvePromotionalProducts(catalog.organizationId, {
      manuallyAddedIds: (config.manuallyAddedIds as string[]) ?? [],
      categoryFilter: (config.categoryFilter as string[]) ?? [],
      autoPromotions: config.autoPromotions === true,
      sortBy: config.sortBy as
        | "discount-desc"
        | "price-asc"
        | "price-desc"
        | "name-asc"
        | "savings-desc"
        | undefined,
    });

    return { name: catalog.name, config: catalog.config, products };
  });
