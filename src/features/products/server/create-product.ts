import prisma from "@/lib/db";
import { ProductUnit, MovementType } from "@/generated/prisma/enums";

/**
 * Dados de entrada para criar um produto. Espelha os campos aceitos pela
 * procedure `products.create`, mas é independente do contexto oRPC para poder
 * ser reusado tanto pelo handler HTTP quanto pela função Inngest de importação.
 */
export interface CreateProductInput {
  name: string;
  categoryId?: string | null;
  description?: string;
  sku?: string;
  barcode?: string;
  unit?: ProductUnit;
  costPrice: number;
  salePrice: number;
  promotionalPrice?: number;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  images?: string[];
  thumbnail?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  trackStock?: boolean;
  prepTimeMinutes?: number;
  supplierId?: string | null;
  // Cadastro fiscal (NFCe/NFe) — todos opcionais. Usados na Fase B
  // (emissão real). Sem eles a venda cai automaticamente em modo não-fiscal.
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  origem?: string | null;
  cstIcms?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  aliqIcms?: number | null;
  aliqPis?: number | null;
  aliqCofins?: number | null;
  cClassTrib?: string | null;
}

/**
 * Erro de regra de negócio ao criar produto (ex.: SKU duplicado). Usado para que
 * os chamadores possam diferenciar de erros inesperados e mapear para a resposta
 * adequada (BAD_REQUEST no oRPC, linha de erro na importação).
 */
export class ProductCreationError extends Error {}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

/**
 * Cria um produto para uma organização: gera slug único, valida SKU, persiste o
 * produto e, se houver estoque inicial, registra a entrada de estoque.
 *
 * Centraliza a lógica que antes vivia inline em `products.create` para que a
 * importação em massa reuse exatamente o mesmo comportamento.
 */
export async function createProductForOrg(
  input: CreateProductInput,
  { orgId, userId }: { orgId: string; userId: string },
) {
  const baseSlug = slugify(input.name);

  const existingProduct = await prisma.product.findUnique({
    where: {
      organizationId_slug: { organizationId: orgId, slug: baseSlug },
    },
  });

  // Slug já em uso na org: garante unicidade com timestamp.
  const finalSlug = existingProduct ? `${baseSlug}-${Date.now()}` : baseSlug;

  if (input.sku) {
    const existingSku = await prisma.product.findFirst({
      where: { organizationId: orgId, sku: input.sku },
    });

    if (existingSku) {
      throw new ProductCreationError("SKU já existe para outro produto");
    }
  }

  const product = await prisma.product.create({
    data: {
      organizationId: orgId,
      createdById: userId,
      name: input.name,
      slug: finalSlug,
      categoryId: input.categoryId ? input.categoryId : null,
      description: input.description,
      sku: input.sku,
      barcode: input.barcode,
      unit: input.unit ?? ProductUnit.UN,
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      promotionalPrice: input.promotionalPrice,
      minStock: input.minStock ?? 0,
      maxStock: input.maxStock,
      images: input.images ?? [],
      thumbnail: input.thumbnail || input.images?.[0] || "",
      weight: input.weight,
      length: input.length,
      width: input.width,
      height: input.height,
      isActive: input.isActive ?? true,
      isFeatured: input.isFeatured ?? false,
      trackStock: input.trackStock ?? true,
      prepTimeMinutes: input.prepTimeMinutes,
      supplierId: input.supplierId ?? null,
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

  // Estoque inicial: registra movimento de entrada e atualiza o saldo do produto.
  if (input.currentStock && input.currentStock > 0) {
    await prisma.stockMovement.create({
      data: {
        type: MovementType.ENTRADA,
        quantity: input.currentStock,
        productId: product.id,
        notes: "Entrada de estoque",
        organizationId: orgId,
        createdById: userId,
        previousStock: 0,
        newStock: input.currentStock,
      },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { currentStock: input.currentStock },
    });
  }

  return product;
}
