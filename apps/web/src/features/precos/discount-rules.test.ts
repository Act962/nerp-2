import { describe, expect, it } from "vitest";
import {
  type CategoryDiscount,
  type ProductPricing,
  decide,
  isWithinWindow,
  pickCategoryDiscount,
} from "./discount-rules";

const NOW = new Date("2026-08-28T12:00:00Z");
const ONTEM = new Date("2026-08-27T12:00:00Z");
const AMANHA = new Date("2026-08-29T12:00:00Z");

// Alface: categoria "Hortifruti" (hf) → subcategoria "Verduras" (vd).
function alface(overrides: Partial<ProductPricing> = {}): ProductPricing {
  return {
    salePrice: 10,
    discountPercent: null,
    discountStartsAt: null,
    discountEndsAt: null,
    categoryId: "vd",
    categoryPath: "hf/vd",
    ...overrides,
  };
}

const HORTIFRUTI_20: CategoryDiscount = {
  categoryId: "hf",
  percentDiscount: 20,
};

function resolve(
  pricing: ProductPricing,
  categoryDiscounts: CategoryDiscount[] = [],
  tier: Parameters<typeof decide>[0]["tier"] = null,
) {
  return decide({
    pricing,
    tier,
    categoryDiscounts,
    priceListId: "lista",
    now: NOW,
  });
}

describe("desconto por categoria", () => {
  // O pedido original: 20% em tudo que for Hortifruti.
  it("aplica o percentual da categoria sobre o preço de venda", () => {
    const result = resolve(alface(), [HORTIFRUTI_20]);

    expect(result.unitPrice).toBe(8);
    expect(result.appliedDiscountPercent).toBe(20);
    expect(result.resolvedFrom).toBe("category-discount");
  });

  it("desce para as subcategorias", () => {
    // A alface está em "Verduras", e o desconto foi cadastrado em "Hortifruti".
    expect(resolve(alface(), [HORTIFRUTI_20]).unitPrice).toBe(8);
  });

  it("entre dois níveis com regra, vence o mais específico", () => {
    const result = resolve(alface(), [
      HORTIFRUTI_20,
      { categoryId: "vd", percentDiscount: 50 },
    ]);

    expect(result.appliedDiscountPercent).toBe(50);
    expect(result.unitPrice).toBe(5);
  });

  it("ignora desconto de categoria de outro ramo da árvore", () => {
    const result = resolve(alface(), [
      { categoryId: "limpeza", percentDiscount: 30 },
    ]);

    expect(result.resolvedFrom).toBe("product");
    expect(result.unitPrice).toBe(10);
  });

  it("produto sem categoria não pega desconto de categoria", () => {
    const semCategoria = alface({ categoryId: null, categoryPath: null });

    expect(pickCategoryDiscount(semCategoria, [HORTIFRUTI_20])).toBeNull();
  });
});

describe("desconto do produto", () => {
  it("vence o desconto da categoria", () => {
    const result = resolve(
      alface({ discountPercent: 10, discountEndsAt: AMANHA }),
      [HORTIFRUTI_20],
    );

    expect(result.appliedDiscountPercent).toBe(10);
    expect(result.resolvedFrom).toBe("product-discount");
  });

  it("some quando a validade passa, sem precisar de job", () => {
    const result = resolve(
      alface({ discountPercent: 10, discountEndsAt: ONTEM }),
      [],
    );

    expect(result.unitPrice).toBe(10);
    expect(result.resolvedFrom).toBe("product");
  });

  it("não vale antes da data de início", () => {
    const result = resolve(
      alface({
        discountPercent: 10,
        discountStartsAt: AMANHA,
        discountEndsAt: AMANHA,
      }),
      [],
    );

    expect(result.resolvedFrom).toBe("product");
  });

  // Com a promoção do produto expirada, a da categoria volta a valer.
  it("expirado, deixa a categoria assumir", () => {
    const result = resolve(
      alface({ discountPercent: 10, discountEndsAt: ONTEM }),
      [HORTIFRUTI_20],
    );

    expect(result.resolvedFrom).toBe("category-discount");
    expect(result.unitPrice).toBe(8);
  });
});

describe("precedência da faixa negociada", () => {
  // Preço fechado com o cliente não pode ser atropelado por promoção geral.
  it("faixa FIXED vence promoção de produto e de categoria", () => {
    const result = resolve(
      alface({ discountPercent: 10, discountEndsAt: AMANHA }),
      [HORTIFRUTI_20],
      { pricingMode: "FIXED", unitPrice: 7.5, percentDiscount: null },
    );

    expect(result.unitPrice).toBe(7.5);
    expect(result.resolvedFrom).toBe("tier-fixed");
  });

  it("faixa PERCENT_DISCOUNT também vence", () => {
    const result = resolve(alface(), [HORTIFRUTI_20], {
      pricingMode: "PERCENT_DISCOUNT",
      unitPrice: null,
      percentDiscount: 5,
    });

    expect(result.unitPrice).toBe(9.5);
    expect(result.resolvedFrom).toBe("tier-percent");
  });
});

describe("isWithinWindow", () => {
  it("sem início, vale desde já", () => {
    expect(isWithinWindow(null, AMANHA, NOW)).toBe(true);
  });

  it("sem fim, não expira", () => {
    expect(isWithinWindow(ONTEM, null, NOW)).toBe(true);
  });

  it("fecha nas duas pontas", () => {
    expect(isWithinWindow(AMANHA, AMANHA, NOW)).toBe(false);
    expect(isWithinWindow(ONTEM, ONTEM, NOW)).toBe(false);
  });
});

describe("arredondamento", () => {
  // O snapshot da venda é Decimal(10,2): o preço resolvido não pode chegar lá
  // com mais casas do que a coluna aceita.
  it("fecha em 2 casas", () => {
    const result = resolve(alface({ salePrice: 9.99 }), [
      { categoryId: "hf", percentDiscount: 33 },
    ]);

    expect(result.unitPrice).toBe(6.69);
  });
});
