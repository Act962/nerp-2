import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { ProductUnit } from "@/generated/prisma/enums";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { inngest, shopperPriceChanged } from "@/lib/inngest/client";

// `undefined` mantém o valor gravado; `null` limpa. Sem a distinção, salvar o
// produto sem mexer no desconto apagaria a promoção.
function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const updateProduct = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar um novo produto",
    tags: ["products"],
  })
  .input(
    z
      .object({
        // Informações básicas
        id: z.string(),
        name: z.string().min(1).optional(),
        categoryId: z.string().optional(),
        description: z.string().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        unit: z.enum(ProductUnit).default(ProductUnit.UN).optional(),

        // Preços
        costPrice: z.number().min(0).optional(),
        salePrice: z.number().min(0).optional(),
        promotionalPrice: z.number().optional(),

        // Desconto promocional (global, com vigência). Datas em ISO; `null`
        // limpa o campo, `undefined` mantém o que está gravado.
        discountPercent: z.number().min(0).max(100).nullable().optional(),
        discountStartsAt: z.string().nullable().optional(),
        discountEndsAt: z.string().nullable().optional(),

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

        // KDS — tempo médio de preparo (min)
        prepTimeMinutes: z.number().int().positive().nullable().optional(),

        supplierId: z.string().nullable().optional(),

        // Cadastro fiscal (Fase B). Todos opcionais.
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
      })
      // Promoção sem fim vira preço permanente por esquecimento — foi o que a
      // validade veio evitar.
      .refine(
        (data) =>
          !data.discountPercent ||
          data.discountPercent <= 0 ||
          !!data.discountEndsAt,
        {
          message: "Informe até quando o desconto vale",
          path: ["discountEndsAt"],
        },
      )
      .refine(
        (data) =>
          !data.discountStartsAt ||
          !data.discountEndsAt ||
          new Date(data.discountStartsAt) <= new Date(data.discountEndsAt),
        {
          message: "O início não pode ser depois do fim",
          path: ["discountEndsAt"],
        },
      ),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // `findFirst` com organizationId, não `findUnique` por id: sem o filtro,
    // qualquer usuário autenticado editaria produto de outra org (IDOR).
    const productExists = await prisma.product.findFirst({
      where: {
        id: input.id,
        organizationId: context.org.id,
      },
    });

    if (!productExists) {
      throw errors.BAD_REQUEST({
        message: "Produto não encontrado!",
      });
    }

    // Criar o produto
    const product = await prisma.product.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        categoryId: input.categoryId === "" ? null : input.categoryId,
        description: input.description,
        sku: input.sku,
        barcode: input.barcode,
        unit: input.unit,
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        promotionalPrice: input.promotionalPrice,
        discountPercent: input.discountPercent,
        discountStartsAt: toDate(input.discountStartsAt),
        discountEndsAt: toDate(input.discountEndsAt),
        minStock: input.minStock,
        maxStock: input.maxStock,
        images: input.images,
        thumbnail: input.thumbnail || input.images[0] || "",
        weight: input.weight,
        length: input.length,
        width: input.width,
        height: input.height,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
        trackStock: input.trackStock,
        prepTimeMinutes: input.prepTimeMinutes,
        supplierId: input.supplierId === "" ? null : input.supplierId,
        ncm: input.ncm ?? undefined,
        cest: input.cest ?? undefined,
        cfop: input.cfop ?? undefined,
        origem: input.origem ?? undefined,
        cstIcms: input.cstIcms ?? undefined,
        cstPis: input.cstPis ?? undefined,
        cstCofins: input.cstCofins ?? undefined,
        aliqIcms: input.aliqIcms ?? undefined,
        aliqPis: input.aliqPis ?? undefined,
        aliqCofins: input.aliqCofins ?? undefined,
        cClassTrib: input.cClassTrib ?? undefined,
      },
    });

    // Preço efetivo (promo ?? venda) caiu → dispara alerta para quem favoritou.
    const effective = (sale: unknown, promo: unknown) => Number(promo ?? sale);
    const oldPrice = effective(
      productExists.salePrice,
      productExists.promotionalPrice,
    );
    const newPrice = effective(product.salePrice, product.promotionalPrice);
    if (newPrice < oldPrice) {
      await inngest
        .send(
          shopperPriceChanged.create({
            organizationId: product.organizationId,
            productId: product.id,
            oldPrice,
            newPrice,
          }),
        )
        .catch((error) => {
          console.error("[products.update] price alert send falhou:", error);
        });
    }

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
    };
  });
