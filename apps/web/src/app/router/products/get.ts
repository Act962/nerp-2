import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { ProductUnit } from "@/generated/prisma/enums";
import z from "zod";
import type { Decimal } from "@prisma/client/runtime/client";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Helper para converter Decimals em números
const decimalToNumber = (value: Decimal | null | undefined): number | null => {
  return value ? value.toNumber() : null;
};

// Schema de resposta reutilizável
const productOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  categoryId: z.string().nullable(),
  category: z.string().nullable(),
  unit: z.nativeEnum(ProductUnit),
  salePrice: z.number(),
  costPrice: z.number(),
  promotionalPrice: z.number().nullable(),
  currentStock: z.number(),
  minStock: z.number(),
  maxStock: z.number().nullable(),
  images: z.array(z.string()),
  thumbnail: z.string(),
  weight: z.number().nullable(),
  length: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  trackStock: z.boolean(),
  // Espelho do ERP — somente leitura na UI. `null` = nunca sincronizado, que é
  // diferente de "inativo no ERP" (`false`).
  erpActive: z.boolean().nullable(),
  erpCode: z.string().nullable(),
  erpSyncedAt: z.date().nullable(),
  prepTimeMinutes: z.number().nullable(),
  supplierId: z.string().nullable(),
  // Cadastro fiscal (Fase B) — todos opcionais.
  ncm: z.string().nullable(),
  cest: z.string().nullable(),
  cfop: z.string().nullable(),
  origem: z.string().nullable(),
  cstIcms: z.string().nullable(),
  cstPis: z.string().nullable(),
  cstCofins: z.string().nullable(),
  aliqIcms: z.number().nullable(),
  aliqPis: z.number().nullable(),
  aliqCofins: z.number().nullable(),
  cClassTrib: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const stockMovementOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  quantity: z.number(),
  createdAt: z.date(),
  notes: z.string().nullable(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
  }),
});

export const getProduct = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/products/:id",
    summary: "Get a product by id",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .output(
    z.object({
      product: productOutputSchema,
      stockMovements: z.array(stockMovementOutputSchema),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const product = await prisma.product.findFirst({
      where: {
        id: input.id,
        organizationId: context.org.id,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        stockMovements: {
          select: {
            id: true,
            type: true,
            quantity: true,
            createdAt: true,
            notes: true,
            createdBy: true,
          },
        },
      },
    });

    if (!product) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado!" });
    }

    const stockMovements = product.stockMovements.map((movement) => ({
      ...movement,
      quantity: movement.quantity.toNumber(),
    }));

    // Transformação mais limpa e concisa
    return {
      product: {
        ...product,
        category: product.category?.name ?? null,
        // Converter Decimals para números
        salePrice: product.salePrice.toNumber(),
        costPrice: product.costPrice.toNumber(),
        promotionalPrice: decimalToNumber(product.promotionalPrice),
        currentStock: product.currentStock.toNumber(),
        minStock: product.minStock.toNumber(),
        maxStock: decimalToNumber(product.maxStock),
        weight: decimalToNumber(product.weight),
        length: decimalToNumber(product.length),
        width: decimalToNumber(product.width),
        height: decimalToNumber(product.height),
        supplierId: product.supplierId ?? null,
        // Fiscal — decimais pra number, strings passam direto (typed pelo Prisma).
        aliqIcms: decimalToNumber(product.aliqIcms),
        aliqPis: decimalToNumber(product.aliqPis),
        aliqCofins: decimalToNumber(product.aliqCofins),
        // Converter Dates para strings
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
      stockMovements,
    };
  });
