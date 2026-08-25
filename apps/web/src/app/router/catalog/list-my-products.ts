import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

export const listProductsOfCart = base
  .route({
    method: "GET",
    summary: "Listar produtos do carrinho",
    tags: ["products"],
  })
  .input(
    z.object({
      subdomain: z.string(),
      productIds: z.array(z.string()).optional(),
    }),
  )
  .output(
    z.object({
      products: z.array(
        z.object({
          id: z.string(),
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

      const products = await prisma.product.findMany({
        where: {
          organizationId: organization.id,
          id: {
            in: input.productIds,
          },
        },
      });

      const productList = products.map((product) => ({
        id: product.id,
        organizationId: product.organizationId,
        name: product.name,
        description: product.description,
        slug: product.slug,
        minStock: Number(product.minStock),
        categoryId: product.categoryId,
        weight: Number(product.weight),
        thumbnail: product.thumbnail,
        currentStock: Number(product.currentStock),
        salePrice: Number(product.salePrice),
      }));

      return {
        products: productList,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
