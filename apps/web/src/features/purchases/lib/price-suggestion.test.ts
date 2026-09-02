import { describe, expect, it } from "vitest";
import { suggestSalePrice } from "./price-suggestion";

describe("suggestSalePrice", () => {
  it("escala o preço na mesma proporção do custo", () => {
    // Custo 5 → 7 (×1,4). Preço 10 acompanha para 14.
    expect(
      suggestSalePrice({
        previousCost: 5,
        previousSalePrice: 10,
        newCost: 7,
      }),
    ).toBe(14);
  });

  it("preserva a margem praticada, não uma margem fixa", () => {
    // Margem de 20% (custo 12, venda 15) continua 20% com o custo em 16.
    const sugerido = suggestSalePrice({
      previousCost: 12,
      previousSalePrice: 15,
      newCost: 16,
    });
    expect(sugerido).toBe(20);
  });

  it("custo que cai puxa o preço para baixo", () => {
    expect(
      suggestSalePrice({
        previousCost: 10,
        previousSalePrice: 20,
        newCost: 8,
      }),
    ).toBe(16);
  });

  it("preserva o prejuízo em vez de escondê-lo", () => {
    // Vendido abaixo do custo: a proporção se mantém, e quem avisa é a tela.
    const sugerido = suggestSalePrice({
      previousCost: 10,
      previousSalePrice: 8,
      newCost: 20,
    });
    expect(sugerido).toBe(16);
  });

  it("não sugere nada quando o custo não mudou", () => {
    expect(
      suggestSalePrice({
        previousCost: 7,
        previousSalePrice: 14,
        newCost: 7,
      }),
    ).toBeNull();
  });

  it("não sugere nada sem custo anterior — não há margem de referência", () => {
    expect(
      suggestSalePrice({
        previousCost: 0,
        previousSalePrice: 14,
        newCost: 7,
      }),
    ).toBeNull();
  });

  it("não sugere nada sem preço anterior", () => {
    expect(
      suggestSalePrice({
        previousCost: 5,
        previousSalePrice: 0,
        newCost: 7,
      }),
    ).toBeNull();
  });

  it("bonificação (custo zero) não gera sugestão", () => {
    expect(
      suggestSalePrice({
        previousCost: 5,
        previousSalePrice: 10,
        newCost: 0,
      }),
    ).toBeNull();
  });
});
