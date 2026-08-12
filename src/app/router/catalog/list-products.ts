import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { sortProducts } from "@/utils/sorteble-products";
import z, { string } from "zod";

export const listProducts = base
  .route({
    method: "GET",
    summary: "Listar produtos",
    tags: ["products"],
  })
  .input(
    z.object({
      subdomain: z.string(),
      categorySlugs: z.array(z.string()).optional(),
      maxValue: z.number().optional(),
      minValue: z.number().optional(),
      // Quando o storefront tem um `CatalogUser` logado, mandar o id aqui
      // faz a listagem já projetar `salePrice` da tabela desse usuário.
      // Guest = default da org.
      catalogUserId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      categories: z.array(
        z.object({
          id: z.string(),
          isActive: z.boolean(),
          name: z.string(),
          description: z.string().optional(),
          slug: z.string(),
          image: z.string().nullable(),
          order: z.number(),
        }),
      ),
      products: z.array(
        z.object({
          id: z.string(),
          isActive: z.boolean(),
          organizationId: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          slug: z.string(),
          minStock: z.number(),
          categoryId: z.string().nullable(),
          weight: z.number().nullable(),
          thumbnail: z.string(),
          currentStock: z.number(),
          salePrice: z.number(),
          promotionalPrice: z.number().nullable(),
          images: z.array(string()).nullable(),
          productIsDisponile: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const { subdomain } = input;
      const organization = await prisma.organization.findUnique({
        where: {
          subdomain,
        },
      });
      if (!organization) {
        throw errors.NOT_FOUND();
      }
      const catalogSettings = await prisma.catalogSettings.findUnique({
        where: {
          organizationId: organization.id,
        },
      });
      const categories = await prisma.category.findMany({
        where: {
          organizationId: organization.id,
        },
      });
      const products = await prisma.product.findMany({
        where: {
          organizationId: organization.id,
          // Catálogo público: só produtos ativos E marcados como visíveis.
          // A caixa/PDV pode continuar usando produto ativo sem exibir.
          isActive: true,
          showInCatalog: true,
          category: {
            ...(input.categorySlugs &&
              input.categorySlugs.length > 0 && {
                slug: {
                  in: input.categorySlugs,
                },
              }),
          },
          ...(input.minValue && {
            salePrice: {
              gte: input.minValue,
            },
          }),
          ...(input.maxValue && {
            salePrice: {
              lte: input.maxValue,
            },
          }),
          ...(catalogSettings?.showProductWithoutStock
            ? {}
            : { currentStock: { gte: 1 } }),
        },
      });

      // Descobre a `priceListId` do usuário logado (se houver) — guest cai
      // na default. `salePrice` retornado é o resolvido pra qty=1.
      let buyerPriceListId: string | null = null;
      if (input.catalogUserId) {
        const cu = await prisma.catalogUser.findFirst({
          where: { id: input.catalogUserId, organizationId: organization.id },
          select: { priceListId: true },
        });
        buyerPriceListId = cu?.priceListId ?? null;
      }
      const resolved = products.length
        ? await resolveManyPrices({
            organizationId: organization.id,
            priceListId: buyerPriceListId,
            items: products.map((p) => ({ productId: p.id, quantity: 1 })),
          })
        : [];
      const resolvedById = new Map(resolved.map((r) => [r.productId, r.unitPrice]));

      let productList = products.map((product) => ({
        id: product.id,
        isActive: product.isActive,
        organizationId: product.organizationId,
        name: product.name,
        description: product.description,
        slug: product.slug,
        minStock: Number(product.minStock),
        categoryId: product.categoryId,
        weight: Number(product.weight),
        thumbnail: product.thumbnail,
        currentStock: Number(product.currentStock),
        salePrice: resolvedById.get(product.id) ?? Number(product.salePrice),
        promotionalPrice: Number(product.promotionalPrice),
        images: product.images,
        productIsDisponile: Number(product.currentStock) > 0,
      }));

      if (catalogSettings?.sortOrder) {
        productList = sortProducts(productList, catalogSettings.sortOrder);
      }

      const categoryList = categories.map((category) => ({
        id: category.id,
        isActive: category.isActive,
        name: category.name,
        slug: category.slug,
        image: category.image,
        order: Number(category.order),
      }));

      return {
        products: productList,
        categories: categoryList,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
