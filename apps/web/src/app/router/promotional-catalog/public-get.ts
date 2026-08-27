import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";
import type { CatalogPage } from "@/features/promotional-catalog/types";
import type { DynamicContext } from "@/features/promotional-catalog/lib/resolve-entity";

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
      // Entidades resolvidas das páginas dinâmicas: pageId → DynamicContext.
      // Resolvidas no servidor (scoped por org do catálogo) p/ o render público.
      dynamicEntities: z.record(z.string(), z.unknown()),
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

    // ── Páginas dinâmicas: resolve as entidades por página (scoped por org do
    // catálogo — por isso não precisa auth). Usuário → fallback (evita PII). ──
    const pages = (config.pages as CatalogPage[] | undefined) ?? [];
    const dynamicEntities: Record<string, DynamicContext> = {};
    const hasDynamic = pages.some((p) => p.dynamic);
    if (hasDynamic) {
      const orgRow = await prisma.organization.findUnique({
        where: { id: catalog.organizationId },
        select: {
          name: true,
          tradeName: true,
          sigla: true,
          city: true,
          state: true,
          logo: true,
        },
      });
      const orgSlice: DynamicContext["org"] = orgRow
        ? {
            name: orgRow.name,
            tradeName: orgRow.tradeName,
            sigla: orgRow.sigla,
            city: orgRow.city,
            state: orgRow.state,
            logo: orgRow.logo,
          }
        : undefined;

      for (const pg of pages) {
        const dyn = pg.dynamic;
        if (!dyn) continue;
        const ctx: DynamicContext = {};
        if (orgSlice) ctx.org = orgSlice;
        if (dyn.type === "store") {
          const store = dyn.refId
            ? await prisma.store.findFirst({
                where: {
                  id: dyn.refId,
                  organizationId: catalog.organizationId,
                },
                select: {
                  name: true,
                  code: true,
                  city: true,
                  state: true,
                  coverImageKey: true,
                },
              })
            : await prisma.store.findFirst({
                where: {
                  organizationId: catalog.organizationId,
                  name: { equals: pg.name, mode: "insensitive" },
                },
                select: {
                  name: true,
                  code: true,
                  city: true,
                  state: true,
                  coverImageKey: true,
                },
              });
          if (store) ctx.store = store;
        } else if (dyn.type === "product" && dyn.refId) {
          const p = products.find((pr) => pr.id === dyn.refId);
          if (p) ctx.product = p;
        } else if (dyn.type === "category" && dyn.refId) {
          const cat = await prisma.category.findFirst({
            where: { id: dyn.refId, organizationId: catalog.organizationId },
            select: { name: true },
          });
          if (cat) ctx.category = { name: cat.name };
        }
        dynamicEntities[pg.id] = ctx;
      }
    }

    return {
      name: catalog.name,
      config: catalog.config,
      dynamicEntities,
      products,
    };
  });
