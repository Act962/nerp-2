import { describe, expect, it } from "vitest";
import { lineTotal, purchaseTotals, round2, unitCost } from "./purchase-totals";

describe("purchase-totals", () => {
  describe("lineTotal", () => {
    it("multiplica e desconta o valor da linha inteira", () => {
      expect(lineTotal({ quantity: 10, unitPrice: 7.5, discount: 5 })).toBe(70);
    });

    it("sem desconto é só quantidade × preço", () => {
      expect(lineTotal({ quantity: 3, unitPrice: 19.9, discount: 0 })).toBe(
        59.7,
      );
    });
  });

  describe("unitCost", () => {
    it("é o total da linha dividido pela quantidade", () => {
      expect(unitCost({ quantity: 10, unitPrice: 7.5, discount: 5 })).toBe(7);
    });

    it("bate com `unitPrice - discount` quando a quantidade é 1", () => {
      expect(unitCost({ quantity: 1, unitPrice: 12.4, discount: 2.4 })).toBe(
        10,
      );
    });

    it("não divide por zero", () => {
      expect(unitCost({ quantity: 0, unitPrice: 9, discount: 0 })).toBe(0);
    });

    it("arredonda a dízima para as 2 casas que a coluna aceita", () => {
      // Caixa de 12 por R$ 10,00: 0,8333… não cabe em Decimal(10,2).
      expect(unitCost({ quantity: 12, unitPrice: 0.8333, discount: 0 })).toBe(
        0.83,
      );
    });
  });

  describe("purchaseTotals", () => {
    const items = [
      { quantity: 10, unitPrice: 7.5, discount: 5 },
      { quantity: 2, unitPrice: 30, discount: 0 },
    ];

    it("soma os itens sem os descontos no subtotal", () => {
      expect(purchaseTotals({ items, discount: 0, shipping: 0 }).subtotal).toBe(
        135,
      );
    });

    it("acumula os descontos das linhas à parte", () => {
      expect(
        purchaseTotals({ items, discount: 0, shipping: 0 }).itemsDiscount,
      ).toBe(5);
    });

    it("junta desconto de linha e de cabeçalho num total de desconto só", () => {
      expect(
        purchaseTotals({ items, discount: 10, shipping: 0 }).totalDiscount,
      ).toBe(15);
    });

    it("o cabeçalho fecha sozinho: subtotal - desconto + frete = total", () => {
      const shipping = 20;
      const t = purchaseTotals({ items, discount: 10, shipping });
      expect(t.subtotal - t.totalDiscount + shipping).toBe(t.total);
    });

    it("soma frete e desconta o abatimento de cabeçalho no total", () => {
      expect(purchaseTotals({ items, discount: 10, shipping: 20 }).total).toBe(
        140,
      );
    });

    it("não deixa o total ficar negativo", () => {
      expect(purchaseTotals({ items, discount: 9999, shipping: 0 }).total).toBe(
        0,
      );
    });

    it("nota vazia zera tudo", () => {
      expect(purchaseTotals({ items: [], discount: 0, shipping: 0 })).toEqual({
        subtotal: 0,
        itemsDiscount: 0,
        totalDiscount: 0,
        total: 0,
      });
    });
  });

  describe("round2", () => {
    it("não deixa o erro binário escapar para a coluna", () => {
      expect(round2(0.1 + 0.2)).toBe(0.3);
      expect(round2(1.005)).toBe(1.01);
    });
  });
});
