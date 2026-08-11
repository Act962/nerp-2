import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z, { string } from "zod";

export const getProductAndProductsByCategory = base
  .route({
    method: "GET",
    summary: "Listar produtos com e produtos com a catagoria relacionada",
    tags: ["products_selected_with_category"],
  })
  .input(
    z.object({
      subdomain: z.string(),
      productSlug: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const organization = await prisma.organization.findUnique({
        where: {
          subdomain: input.subdomain,
        },
      });
      if (!organization) {
        throw errors.NOT_FOUND();
      }

      const product = await prisma.product.findUnique({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: input.productSlug,
          },
        },
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!product) {
        throw errors.NOT_FOUND({
          message: "Produto não encontrado",
        });
      }

      const productsWithCategory = await prisma.product.findMany({
        where: {
          slug: {
            not: input.productSlug,
          },
          organizationId: organization.id,
          categoryId: product.categoryId,
          isActive: true,
          showInCatalog: true,
        },
        take: 4,
      });

      const productsList = productsWithCategory.map((product) => ({
        id: product.id,
        isActive: product.isActive,
        name: product.name,
        description: product.description,
        slug: product.slug,
        sku: product.sku,
        minStock: Number(product.minStock),
        categoryId: product.categoryId,
        weight: Number(product.weight),
        thumbnail: product.thumbnail,
        currentStock: Number(product.currentStock),
        salePrice: Number(product.salePrice),
        promotionalPrice: Number(product.promotionalPrice),
        images: product.images,
      }));

      const productIsDisponile = Number(product.currentStock) > 0;
      return {
        product: {
          ...product,
          salePrice: Number(product.salePrice),
          currentStock: Number(product.currentStock),
          minStock: Number(product.minStock),
          weight: Number(product.weight),
          category: product.category as { name: string; slug: string },
          promotionalPrice: Number(product.promotionalPrice),
        },
        productsWithThisCategory: productsList || [],
        productIsDisponile,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
