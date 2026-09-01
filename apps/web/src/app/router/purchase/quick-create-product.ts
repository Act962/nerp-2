import { createProductForOrg } from "@/features/products/server/create-product";
import { Prisma } from "@/generated/prisma/client";
import { ProductUnit } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";
import { getPurchaseAccess } from "./_access";
import { p } from "./_shared";

const productRow = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  unit: z.enum(ProductUnit),
  costPrice: z.number(),
  salePrice: z.number(),
  currentStock: z.number(),
  trackStock: z.boolean(),
});

/**
 * Cadastro mínimo de produto sem sair da entrada de nota.
 *
 * Procedure própria, e não `products.create`, por três motivos: devolve a linha
 * pronta para entrar na nota sem um segundo round trip, tem contrato de saída
 * explícito, e é liberada pela permissão de ENTRADA — exigir a de produtos
 * bloquearia justamente quem está digitando a nota. Quem pode dar entrada pode
 * cadastrar o produto que veio nela.
 */
export const quickCreateProduct = p
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do produto"),
      barcode: z.string().nullable().default(null),
      sku: z.string().nullable().default(null),
      unit: z.enum(ProductUnit).default(ProductUnit.UN),
      costPrice: z.number().min(0).default(0),
      salePrice: z.number().min(0),
      supplierId: z.string().nullable().default(null),
    }),
  )
  .output(
    z.object({
      product: productRow,
      /** Já existia um produto com este código de barras. */
      alreadyExisted: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cadastrar produtos por aqui",
      });
    }

    // String vazia NÃO é ausência de código: `""` colide no
    // @@unique([organizationId, barcode]), NULL não. O segundo produto sem
    // código de barras estouraria P2002 sem isso.
    const barcode = input.barcode?.trim() || undefined;
    const sku = input.sku?.trim() || undefined;

    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: { organizationId: context.org.id, barcode },
        select: productSelect,
      });
      // Bipar de novo um produto já cadastrado não é erro: devolve o que existe
      // e deixa a tela oferecer "usar este".
      if (existing) return { product: toRow(existing), alreadyExisted: true };
    }

    if (
      input.supplierId &&
      !(await prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: context.org.id },
        select: { id: true },
      }))
    ) {
      throw errors.NOT_FOUND({ message: "Fornecedor não encontrado" });
    }

    try {
      const created = await createProductForOrg(
        {
          name: input.name,
          barcode,
          sku,
          unit: input.unit,
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          supplierId: input.supplierId,
          // Sempre zero: quem põe estoque é o processamento da nota. Semear
          // aqui e processar depois contaria a mesma mercadoria duas vezes,
          // porque `createProductForOrg` cria um movimento de ENTRADA quando
          // este campo é maior que zero.
          currentStock: 0,
        },
        { orgId: context.org.id, userId: context.user.id },
      );

      return {
        product: toRow(created),
        alreadyExisted: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw errors.BAD_REQUEST({
          message: "Já existe um produto com este código de barras ou SKU",
        });
      }
      throw error;
    }
  });

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  unit: true,
  costPrice: true,
  salePrice: true,
  currentStock: true,
  trackStock: true,
} as const;

function toRow(product: {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: ProductUnit;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  currentStock: Prisma.Decimal;
  trackStock: boolean;
}) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    unit: product.unit,
    costPrice: product.costPrice.toNumber(),
    salePrice: product.salePrice.toNumber(),
    currentStock: product.currentStock.toNumber(),
    trackStock: product.trackStock,
  };
}
