// Resolver de preço unitário no server — fonte da verdade que PDV, storefront
// e integrações compartilham. Dado (produto, quantidade, tabela do cliente),
// devolve o `unitPrice` que deve entrar no `SaleItem`. Nunca aceitamos preço
// do cliente cegamente (era o padrão antigo — vazamento).
//
// Ordem de decisão:
//   1. Se `priceListId` é nulo → usa a `PriceList.isDefault` da org.
//   2. Procura a maior faixa (`minQuantity <= qty`) desse produto na tabela.
//   3. FIXED           → `unitPrice` da faixa.
//      PERCENT_DISCOUNT → `salePrice * (1 − percentDiscount/100)`.
//   4. Sem faixa na tabela → cai no `salePrice` do produto.

import prisma from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

export type PriceResolvedFrom = "tier-fixed" | "tier-percent" | "product";

export interface ResolvedPrice {
  unitPrice: number;
  appliedDiscountPercent: number | null;
  resolvedFrom: PriceResolvedFrom;
  priceListId: string | null;
}

export interface ResolvePriceArgs {
  organizationId: string;
  productId: string;
  quantity: number;
  /** Tabela do cliente. Null → cai na default da org. */
  priceListId?: string | null;
  /**
   * Opcional: quando o chamador já tem o `salePrice` em mãos (ex.: batch),
   * evita um `product.findUnique` a mais.
   */
  productSalePrice?: number;
  /** Cliente Prisma (permite reuso em transactions). */
  tx?: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
}

// Cache in-request só do salePrice, pra `resolveMany` não bater no DB N vezes
// pelo mesmo produto quando o carrinho tem várias linhas dele.
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

export async function resolvePrice(
  args: ResolvePriceArgs,
): Promise<ResolvedPrice> {
  const client = (args.tx ?? prisma) as PrismaClient;
  const { organizationId, productId } = args;
  const quantity = Number.isFinite(args.quantity) && args.quantity > 0
    ? args.quantity
    : 1;

  const priceListId = args.priceListId
    ? args.priceListId
    : await loadDefaultPriceListId(client, organizationId);

  // salePrice do produto: base para o modo PERCENT e fallback quando não há faixa.
  const salePrice = args.productSalePrice
    ?? Number(
      (
        await client.product.findFirst({
          where: { id: productId, organizationId },
          select: { salePrice: true },
        })
      )?.salePrice ?? 0,
    );

  if (!priceListId) {
    return {
      unitPrice: salePrice,
      appliedDiscountPercent: null,
      resolvedFrom: "product",
      priceListId: null,
    };
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

  if (!tier) {
    return {
      unitPrice: salePrice,
      appliedDiscountPercent: null,
      resolvedFrom: "product",
      priceListId,
    };
  }

  if (tier.pricingMode === "PERCENT_DISCOUNT") {
    const percent = Number(tier.percentDiscount ?? 0);
    // arredonda a 2 casas para casar com Decimal(10,2) no snapshot
    const raw = salePrice * (1 - percent / 100);
    const unitPrice = Math.round(raw * 100) / 100;
    return {
      unitPrice,
      appliedDiscountPercent: percent,
      resolvedFrom: "tier-percent",
      priceListId,
    };
  }

  // FIXED
  return {
    unitPrice: Number(tier.unitPrice ?? salePrice),
    appliedDiscountPercent: null,
    resolvedFrom: "tier-fixed",
    priceListId,
  };
}

export interface ResolveManyItem {
  productId: string;
  quantity: number;
}

/**
 * Resolve preço de várias linhas de uma vez — usado pelo PDV pra re-precificar
 * o carrinho quando o cliente muda, e pelos handlers de venda pra evitar N
 * roundtrips. Uma única leitura de `salePrice` por produto distinto.
 */
export async function resolveManyPrices(
  args: {
    organizationId: string;
    priceListId?: string | null;
    items: ResolveManyItem[];
    tx?: ResolvePriceArgs["tx"];
  },
): Promise<Array<ResolvedPrice & { productId: string; quantity: number }>> {
  const client = (args.tx ?? prisma) as PrismaClient;
  const uniqueIds = Array.from(new Set(args.items.map((i) => i.productId)));
  if (uniqueIds.length === 0) return [];

  const salePrices = await client.product.findMany({
    where: { id: { in: uniqueIds }, organizationId: args.organizationId },
    select: { id: true, salePrice: true },
  });
  const salePriceById = new Map(
    salePrices.map((p) => [p.id, Number(p.salePrice)]),
  );

  const priceListId = args.priceListId
    ? args.priceListId
    : await loadDefaultPriceListId(client, args.organizationId);

  const results: Array<
    ResolvedPrice & { productId: string; quantity: number }
  > = [];
  for (const item of args.items) {
    const resolved = await resolvePrice({
      organizationId: args.organizationId,
      productId: item.productId,
      quantity: item.quantity,
      priceListId,
      productSalePrice: salePriceById.get(item.productId) ?? 0,
      tx: client,
    });
    results.push({ ...resolved, productId: item.productId, quantity: item.quantity });
  }
  return results;
}
