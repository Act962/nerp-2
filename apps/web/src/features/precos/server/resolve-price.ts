// Resolver de preço unitário no server — fonte da verdade que PDV, storefront
// e integrações compartilham. Dado (produto, quantidade, tabela do cliente),
// devolve o `unitPrice` que deve entrar no `SaleItem`. Nunca aceitamos preço
// do cliente cegamente (era o padrão antigo — vazamento).
//
// Ordem de decisão — MAIS ESPECÍFICO VENCE:
//   1. Se `priceListId` é nulo → usa a `PriceList.isDefault` da org.
//   2. Faixa do produto na tabela (`minQuantity <= qty`, a maior):
//      FIXED → `unitPrice` da faixa. PERCENT_DISCOUNT → % sobre `salePrice`.
//      Preço negociado com o cliente prevalece sobre promoção geral.
//   3. Desconto promocional do produto, se vigente (% sobre `salePrice`).
//   4. Desconto da categoria naquela tabela, se vigente — incluindo herança
//      para subcategorias, vencendo o nível mais profundo.
//   5. Nada disso → `salePrice` do produto.
//
// A vigência é decidida aqui, na leitura. Não há job para ligar ou desligar
// promoção: passou da data, o preço volta sozinho.

import prisma from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

import {
  decide,
  EMPTY_PRICING,
  type CategoryDiscount,
  type ProductPricing,
  type ResolvedPrice,
} from "../discount-rules";

export type {
  PriceResolvedFrom,
  ResolvedPrice,
} from "../discount-rules";

export interface ResolvePriceArgs {
  organizationId: string;
  productId: string;
  quantity: number;
  /** Tabela do cliente. Null → cai na default da org. */
  priceListId?: string | null;
  /**
   * Opcional: quando o chamador já tem o `salePrice` em mãos, evita reler essa
   * coluna. Os campos de desconto ainda são buscados — sem eles a promoção
   * simplesmente não sairia.
   */
  productSalePrice?: number;
  /** Cliente Prisma (permite reuso em transactions). */
  tx?:
    | PrismaClient
    | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
}

type Client = ResolvePriceArgs["tx"] extends infer T ? T : never;

async function loadDefaultPriceListId(
  client: NonNullable<Client>,
  organizationId: string,
): Promise<string | null> {
  const defaultList = await (client as PrismaClient).priceList.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
    select: { id: true },
  });
  return defaultList?.id ?? null;
}
async function loadProductPricing(
  client: PrismaClient,
  organizationId: string,
  productIds: string[],
): Promise<Map<string, ProductPricing>> {
  const rows = await client.product.findMany({
    where: { id: { in: productIds }, organizationId },
    select: {
      id: true,
      salePrice: true,
      discountPercent: true,
      discountStartsAt: true,
      discountEndsAt: true,
      categoryId: true,
      category: { select: { path: true } },
    },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      {
        salePrice: Number(row.salePrice),
        discountPercent:
          row.discountPercent === null ? null : Number(row.discountPercent),
        discountStartsAt: row.discountStartsAt,
        discountEndsAt: row.discountEndsAt,
        categoryId: row.categoryId,
        categoryPath: row.category?.path ?? null,
      },
    ]),
  );
}
/**
 * Descontos de categoria VIGENTES da tabela. Carregados de uma vez (são poucos
 * por tabela) e casados em memória contra a árvore de cada produto — evita uma
 * consulta por linha do carrinho.
 */
async function loadCategoryDiscounts(
  client: PrismaClient,
  organizationId: string,
  priceListId: string,
  now: Date,
): Promise<CategoryDiscount[]> {
  const rows = await client.priceListCategoryDiscount.findMany({
    where: {
      organizationId,
      priceListId,
      endsAt: { gte: now },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    },
    select: { categoryId: true, percentDiscount: true },
  });
  return rows.map((row) => ({
    categoryId: row.categoryId,
    percentDiscount: Number(row.percentDiscount),
  }));
}

export async function resolvePrice(
  args: ResolvePriceArgs,
): Promise<ResolvedPrice> {
  const client = (args.tx ?? prisma) as PrismaClient;
  const { organizationId, productId } = args;
  const now = new Date();
  const quantity =
    Number.isFinite(args.quantity) && args.quantity > 0 ? args.quantity : 1;

  const priceListId = args.priceListId
    ? args.priceListId
    : await loadDefaultPriceListId(client, organizationId);

  const loaded = await loadProductPricing(client, organizationId, [productId]);
  const pricing: ProductPricing = {
    ...(loaded.get(productId) ?? EMPTY_PRICING),
    // O chamador pode ter o salePrice em mãos; os demais campos vêm do banco.
    ...(args.productSalePrice !== undefined
      ? { salePrice: args.productSalePrice }
      : {}),
  };

  if (!priceListId) {
    // Sem tabela ainda cabe promoção: o desconto do produto é global.
    return decide({
      pricing,
      tier: null,
      categoryDiscounts: [],
      priceListId: null,
      now,
    });
  }

  const tier = await client.productPrice.findFirst({
    where: {
      organizationId,
      productId,
      priceListId,
      minQuantity: { lte: Math.floor(quantity) },
    },
    orderBy: { minQuantity: "desc" },
    select: { pricingMode: true, unitPrice: true, percentDiscount: true },
  });

  const categoryDiscounts = tier
    ? []
    : await loadCategoryDiscounts(client, organizationId, priceListId, now);

  return decide({ pricing, tier, categoryDiscounts, priceListId, now });
}

export interface ResolveManyItem {
  productId: string;
  quantity: number;
}

/**
 * Resolve preço de várias linhas de uma vez — usado pelo PDV pra re-precificar
 * o carrinho quando o cliente muda, e pelos handlers de venda pra evitar N
 * roundtrips. Uma leitura por produto distinto e UMA dos descontos de
 * categoria, independente do tamanho do carrinho.
 */
export async function resolveManyPrices(args: {
  organizationId: string;
  priceListId?: string | null;
  items: ResolveManyItem[];
  tx?: ResolvePriceArgs["tx"];
}): Promise<Array<ResolvedPrice & { productId: string; quantity: number }>> {
  const client = (args.tx ?? prisma) as PrismaClient;
  const uniqueIds = Array.from(new Set(args.items.map((i) => i.productId)));
  if (uniqueIds.length === 0) return [];

  const now = new Date();
  const pricingById = await loadProductPricing(
    client,
    args.organizationId,
    uniqueIds,
  );

  const priceListId = args.priceListId
    ? args.priceListId
    : await loadDefaultPriceListId(client, args.organizationId);

  const categoryDiscounts = priceListId
    ? await loadCategoryDiscounts(client, args.organizationId, priceListId, now)
    : [];

  const results: Array<
    ResolvedPrice & { productId: string; quantity: number }
  > = [];
  for (const item of args.items) {
    const pricing = pricingById.get(item.productId) ?? EMPTY_PRICING;
    const quantity =
      Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;

    const tier = priceListId
      ? await client.productPrice.findFirst({
          where: {
            organizationId: args.organizationId,
            productId: item.productId,
            priceListId,
            minQuantity: { lte: Math.floor(quantity) },
          },
          orderBy: { minQuantity: "desc" },
          select: { pricingMode: true, unitPrice: true, percentDiscount: true },
        })
      : null;

    results.push({
      ...decide({ pricing, tier, categoryDiscounts, priceListId, now }),
      productId: item.productId,
      quantity: item.quantity,
    });
  }
  return results;
}
