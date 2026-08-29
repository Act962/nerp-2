import { describe, expect, it } from "vitest";
import {
  type CountLine,
  buildAdjustmentPlan,
  summarizeCount,
} from "./inventory-count";

function linha(over: Partial<CountLine> = {}): CountLine {
  return {
    productId: "p1",
    productName: "Arroz 5kg",
    countedQuantity: 10,
    systemQuantity: 10,
    currentStock: 10,
    ...over,
  };
}

describe("buildAdjustmentPlan", () => {
  it("ignora linha que bateu — movimento de zero só sujaria o histórico", () => {
    expect(buildAdjustmentPlan([linha()])).toEqual([]);
  });

  it("falta vira ajuste negativo", () => {
    const [item] = buildAdjustmentPlan([
      linha({ countedQuantity: 7, systemQuantity: 10, currentStock: 10 }),
    ]);

    expect(item.divergence).toBe(-3);
    expect(item.newStock).toBe(7);
  });

  it("sobra vira ajuste positivo", () => {
    const [item] = buildAdjustmentPlan([
      linha({ countedQuantity: 12, systemQuantity: 10, currentStock: 10 }),
    ]);

    expect(item.divergence).toBe(2);
    expect(item.newStock).toBe(12);
  });

  // O coração da regra: se venderam 4 entre contar e aplicar, gravar o contado
  // (10) ressuscitaria as 4 unidades vendidas. Aplicar a diferença preserva a
  // venda.
  it("aplica a diferença sobre o saldo ATUAL, não grava o contado", () => {
    const [item] = buildAdjustmentPlan([
      linha({ countedQuantity: 10, systemQuantity: 12, currentStock: 8 }),
    ]);

    expect(item.divergence).toBe(-2);
    expect(item.newStock).toBe(6); // 8 atual − 2 de falta, e não 10
    expect(item.driftedSinceCount).toBe(true);
  });

  it("marca quem mexeu entre contar e aplicar", () => {
    const [parado] = buildAdjustmentPlan([
      linha({ countedQuantity: 9, systemQuantity: 10, currentStock: 10 }),
    ]);
    expect(parado.driftedSinceCount).toBe(false);
  });

  it("prateleira vazia é resultado válido", () => {
    const [item] = buildAdjustmentPlan([
      linha({ countedQuantity: 0, systemQuantity: 5, currentStock: 5 }),
    ]);

    expect(item.divergence).toBe(-5);
    expect(item.newStock).toBe(0);
  });
});

describe("summarizeCount", () => {
  it("separa sobras de faltas e soma o líquido", () => {
    const resumo = summarizeCount([
      linha({ productId: "a", countedQuantity: 12, systemQuantity: 10 }),
      linha({ productId: "b", countedQuantity: 7, systemQuantity: 10 }),
      linha({ productId: "c", countedQuantity: 10, systemQuantity: 10 }),
    ]);

    expect(resumo).toMatchObject({
      counted: 3,
      divergent: 2,
      positive: 1,
      negative: 1,
      netUnits: -1,
    });
  });

  it("conta as linhas que mexeram desde a contagem", () => {
    const resumo = summarizeCount([
      linha({ systemQuantity: 10, currentStock: 8 }),
      linha({ productId: "b", systemQuantity: 5, currentStock: 5 }),
    ]);

    expect(resumo.drifted).toBe(1);
  });

  it("sessão vazia não quebra", () => {
    expect(summarizeCount([])).toMatchObject({ counted: 0, divergent: 0 });
  });
});
