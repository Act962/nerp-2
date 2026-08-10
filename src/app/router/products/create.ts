import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { ProductUnit } from "@/generated/prisma/enums";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  createProductForOrg,
  ProductCreationError,
} from "@/features/products/server/create-product";

export const createProduct = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar um novo produto",
    tags: ["products"],
  })
  .input(
    z.object({
      // Informações básicas
      name: z.string().min(1),
      categoryId: z.string().optional(),
      description: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      unit: z.enum(ProductUnit).default(ProductUnit.UN),

      // Preços
      costPrice: z.number().min(0),
      salePrice: z.number().min(0),
      promotionalPrice: z.number().optional(),

      // Estoque
      currentStock: z.number().default(0),
      minStock: z.number().default(0),
      maxStock: z.number().optional(),
      location: z.string().optional(),

      // Imagens
      images: z.array(z.string()).default([]),
      thumbnail: z.string().optional(),

      // Dimensões e peso
      weight: z.number().optional(),
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),

      // Controle
      isActive: z.boolean().default(true),
      isFeatured: z.boolean().default(false),
      trackStock: z.boolean().default(true),
      allowNegative: z.boolean().default(false),
      showOnCatalog: z.boolean().default(true),

      // KDS — tempo médio de preparo (min)
      prepTimeMinutes: z.number().int().positive().optional(),

      supplierId: z.string().optional(),

      // Cadastro fiscal (Fase B). Todos opcionais aqui — sem eles, a venda cai
      // em modo não-fiscal e ninguém quebra.
      ncm: z.string().nullable().optional(),
      cest: z.string().nullable().optional(),
      cfop: z.string().nullable().optional(),
      origem: z.string().nullable().optional(),
      cstIcms: z.string().nullable().optional(),
      cstPis: z.string().nullable().optional(),
      cstCofins: z.string().nullable().optional(),
      aliqIcms: z.number().nullable().optional(),
      aliqPis: z.number().nullable().optional(),
      aliqCofins: z.number().nullable().optional(),
      cClassTrib: z.string().nullable().optional(),
    }),
  )
  // .output(
  //   z.object({
  //     id: z.string(),
  //     name: z.string(),
  //     slug: z.string(),
  //   })
  // )
  .handler(async ({ input, context, errors }) => {
    try {
      const product = await createProductForOrg(
        {
          ...input,
          categoryId: input.categoryId === "" ? null : input.categoryId,
        },
        { orgId: context.org.id, userId: context.user.id },
      );

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
      };
    } catch (error) {
      // Regras de negócio (ex.: SKU duplicado) viram BAD_REQUEST.
      if (error instanceof ProductCreationError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }
  });
