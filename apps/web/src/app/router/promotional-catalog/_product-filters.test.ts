import { describe, expect, it } from "vitest";
import { activeFilterCount, productFilterWhere } from "./_product-filters";

describe("productFilterWhere", () => {
  it("sem filtros não filtra nada — é o que preserva os chamadores antigos", () => {
    expect(productFilterWhere(undefined)).toEqual({});
    expect(productFilterWhere({})).toEqual({});
  });

  it("onlyActive filtra o ERP, inOnlineCatalog filtra o storefront", () => {
    // São campos DISTINTOS: ativo no ERP não implica visível no catálogo.
    expect(productFilterWhere({ onlyActive: true })).toEqual({
      isActive: true,
    });
    expect(productFilterWhere({ inOnlineCatalog: true })).toEqual({
      showInCatalog: true,
    });
    expect(
      productFilterWhere({ onlyActive: true, inOnlineCatalog: true }),
    ).toEqual({ isActive: true, showInCatalog: true });
  });

  it('"com foto" usa thumbnail !== "" (o campo tem default vazio, não null)', () => {
    expect(productFilterWhere({ withImage: true })).toEqual({
      thumbnail: { not: "" },
    });
  });

  it("withPromotion exige promotionalPrice preenchido", () => {
    expect(productFilterWhere({ withPromotion: true })).toEqual({
      promotionalPrice: { not: null },
    });
  });

  it("faixa de preço aceita só o mínimo, só o máximo, ou os dois", () => {
    expect(productFilterWhere({ minPrice: 5 })).toEqual({
      salePrice: { gte: 5 },
    });
    expect(productFilterWhere({ maxPrice: 10 })).toEqual({
      salePrice: { lte: 10 },
    });
    expect(productFilterWhere({ minPrice: 5, maxPrice: 10 })).toEqual({
      salePrice: { gte: 5, lte: 10 },
    });
  });

  it("preço ZERO conta como filtro — não pode cair no falsy", () => {
    expect(productFilterWhere({ minPrice: 0 })).toEqual({
      salePrice: { gte: 0 },
    });
  });

  it("chaves desligadas não entram no where", () => {
    expect(
      productFilterWhere({
        onlyActive: false,
        withImage: false,
        withPromotion: false,
        inOnlineCatalog: false,
      }),
    ).toEqual({});
  });

  it("combina tudo num where só", () => {
    expect(
      productFilterWhere({
        onlyActive: true,
        withImage: true,
        withPromotion: true,
        minPrice: 2,
      }),
    ).toEqual({
      isActive: true,
      thumbnail: { not: "" },
      promotionalPrice: { not: null },
      salePrice: { gte: 2 },
    });
  });
});

describe("activeFilterCount", () => {
  it("conta as chaves ligadas", () => {
    expect(activeFilterCount(undefined)).toBe(0);
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ onlyActive: true })).toBe(1);
    expect(activeFilterCount({ onlyActive: true, withImage: true })).toBe(2);
  });

  it("a faixa de preço conta como UM filtro, com um ou dois limites", () => {
    expect(activeFilterCount({ minPrice: 5 })).toBe(1);
    expect(activeFilterCount({ minPrice: 5, maxPrice: 10 })).toBe(1);
  });
});
