// Regras puras de desconto — sem Prisma, sem I/O. O `resolve-price.ts` carrega
// os dados e delega a DECISÃO para cá, que é o que precisa ser testável e o
// que precisa estar escrito num lugar só.

export type PriceResolvedFrom =
  | "tier-fixed"
  | "tier-percent"
  | "product-discount"
  | "category-discount"
  | "product";

export interface ResolvedPrice {
  unitPrice: number;
  appliedDiscountPercent: number | null;
  resolvedFrom: PriceResolvedFrom;
  priceListId: string | null;
}

/** Dados do produto que participam da decisão de preço. */
export interface ProductPricing {
  salePrice: number;
  discountPercent: number | null;
  discountStartsAt: Date | null;
  discountEndsAt: Date | null;
  categoryId: string | null;
  /** Materialized path da categoria ("catA/subB"); null cai no próprio id. */
  categoryPath: string | null;
}

export interface CategoryDiscount {
  categoryId: string;
  percentDiscount: number;
}

export interface PriceTier {
  pricingMode: string;
  unitPrice: unknown;
  percentDiscount: unknown;
}

/** Ids da categoria do produto e de todos os ancestrais, da raiz à folha. */
export function categoryAncestry(pricing: ProductPricing): string[] {
  if (pricing.categoryPath) return pricing.categoryPath.split("/");
  return pricing.categoryId ? [pricing.categoryId] : [];
}

/**
 * Desconto da categoria mais ESPECÍFICA que tem regra. Um desconto em
 * "Hortifruti" alcança "Hortifruti/Frutas", mas se as duas tiverem regra, a de
 * "Frutas" manda — é a decisão mais deliberada das duas.
 */
export function pickCategoryDiscount(
  pricing: ProductPricing,
  discounts: CategoryDiscount[],
): number | null {
  const ancestry = categoryAncestry(pricing);
  if (ancestry.length === 0 || discounts.length === 0) return null;

  let best: number | null = null;
  let bestDepth = -1;
  for (const discount of discounts) {
    const depth = ancestry.indexOf(discount.categoryId);
    if (depth > bestDepth) {
      bestDepth = depth;
      best = discount.percentDiscount;
    }
  }
  return best;
}

/** Promoção só vale dentro da janela; sem início, vale desde já. */
export function isWithinWindow(
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
): boolean {
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() < now.getTime()) return false;
  return true;
}

export function activeProductDiscount(
  pricing: ProductPricing,
  now: Date,
): number | null {
  const percent = pricing.discountPercent;
  if (percent === null || percent <= 0) return null;
  if (!isWithinWindow(pricing.discountStartsAt, pricing.discountEndsAt, now)) {
    return null;
  }
  return percent;
}

/** Arredonda para 2 casas, casando com o Decimal(10,2) do snapshot da venda. */
export function applyPercent(salePrice: number, percent: number): number {
  return Math.round(salePrice * (1 - percent / 100) * 100) / 100;
}

export interface DecideArgs {
  pricing: ProductPricing;
  tier: PriceTier | null;
  categoryDiscounts: CategoryDiscount[];
  priceListId: string | null;
  now: Date;
}

/**
 * MAIS ESPECÍFICO VENCE: faixa da tabela → desconto do produto → desconto da
 * categoria → preço de venda. O preço negociado com o cliente prevalece sobre
 * a promoção geral; por isso a faixa curto-circuita as duas promoções.
 */
export function decide({
  pricing,
  tier,
  categoryDiscounts,
  priceListId,
  now,
}: DecideArgs): ResolvedPrice {
  const { salePrice } = pricing;

  if (tier) {
    if (tier.pricingMode === "PERCENT_DISCOUNT") {
      const percent = Number(tier.percentDiscount ?? 0);
      return {
        unitPrice: applyPercent(salePrice, percent),
        appliedDiscountPercent: percent,
        resolvedFrom: "tier-percent",
        priceListId,
      };
    }
    return {
      unitPrice: Number(tier.unitPrice ?? salePrice),
      appliedDiscountPercent: null,
      resolvedFrom: "tier-fixed",
      priceListId,
    };
  }

  const productPercent = activeProductDiscount(pricing, now);
  if (productPercent !== null) {
    return {
      unitPrice: applyPercent(salePrice, productPercent),
      appliedDiscountPercent: productPercent,
      resolvedFrom: "product-discount",
      priceListId,
    };
  }

  const categoryPercent = pickCategoryDiscount(pricing, categoryDiscounts);
  if (categoryPercent !== null && categoryPercent > 0) {
    return {
      unitPrice: applyPercent(salePrice, categoryPercent),
      appliedDiscountPercent: categoryPercent,
      resolvedFrom: "category-discount",
      priceListId,
    };
  }

  return {
    unitPrice: salePrice,
    appliedDiscountPercent: null,
    resolvedFrom: "product",
    priceListId,
  };
}

export const EMPTY_PRICING: ProductPricing = {
  salePrice: 0,
  discountPercent: null,
  discountStartsAt: null,
  discountEndsAt: null,
  categoryId: null,
  categoryPath: null,
};
