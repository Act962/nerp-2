import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";

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
      // Inclui automaticamente todos os promocionais ativos. Default false — o
      // catálogo só mostra o que foi escolhido (manual/categoria).
      autoPromotions: z.boolean().optional(),
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
        unit: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    return resolvePromotionalProducts(context.org.id, input);
  });
