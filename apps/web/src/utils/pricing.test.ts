import { describe, expect, it } from "vitest";
import {
  computePriceMetrics,
  formatPercent,
  salePriceFromMargin,
  salePriceFromMarkup,
  salePriceFromProfit,
} from "./pricing";

describe("computePriceMetrics", () => {
  // O exemplo canônico do domínio: custo 12, venda 15.
  it("separa margem (sobre a venda) de markup (sobre o custo)", () => {
    const { profit, marginPercent, markupPercent } = computePriceMetrics(
      12,
      15,
    );

    expect(profit).toBe(3);
    expect(marginPercent).toBeCloseTo(20);
    expect(markupPercent).toBeCloseTo(25);
  });

  it("nunca devolve margem e markup iguais quando há lucro", () => {
    const { marginPercent, markupPercent } = computePriceMetrics(80, 100);

    expect(marginPercent).toBeCloseTo(20);
    expect(markupPercent).toBeCloseTo(25);
    expect(marginPercent).not.toBe(markupPercent);
  });

  it("aceita centavos porque as razões são adimensionais", () => {
    const reais = computePriceMetrics(12, 15);
    const centavos = computePriceMetrics(1200, 1500);

    expect(centavos.marginPercent).toBeCloseTo(reais.marginPercent ?? 0);
    expect(centavos.markupPercent).toBeCloseTo(reais.markupPercent ?? 0);
    expect(centavos.profit).toBe(300);
  });

  it("reporta prejuízo quando a venda é menor que o custo", () => {
    const { profit, marginPercent, markupPercent } = computePriceMetrics(
      15,
      12,
    );

    expect(profit).toBe(-3);
    expect(marginPercent).toBeCloseTo(-25);
    expect(markupPercent).toBeCloseTo(-20);
  });

  // Sem base, devolver 0% seria afirmar algo falso — e dividir por zero daria
  // Infinity, que vazaria como "∞%" na tela.
  it("devolve null em vez de 0% ou Infinity quando falta a base", () => {
    expect(computePriceMetrics(12, 0).marginPercent).toBeNull();
    expect(computePriceMetrics(0, 15).markupPercent).toBeNull();
    expect(computePriceMetrics(0, 0)).toEqual({
      profit: 0,
      marginPercent: null,
      markupPercent: null,
    });
  });

  it("com custo zero o lucro é a venda inteira e a margem é 100%", () => {
    const { profit, marginPercent } = computePriceMetrics(0, 15);

    expect(profit).toBe(15);
    expect(marginPercent).toBeCloseTo(100);
  });
});

describe("formatPercent", () => {
  it("formata em pt-BR com duas casas", () => {
    expect(formatPercent(20)).toBe("20,00%");
    expect(formatPercent(-7.456)).toBe("-7,46%");
  });
});

describe("caminho inverso (meta → preço de venda)", () => {
  // Fecha o ciclo com o exemplo canônico: custo 12 e qualquer uma das três
  // metas tem que devolver venda 15.
  it("as três metas convergem para o mesmo preço", () => {
    expect(salePriceFromProfit(12, 3)).toBe(15);
    expect(salePriceFromMargin(12, 20)).toBe(15);
    expect(salePriceFromMarkup(12, 25)).toBe(15);
  });

  it("ida e volta preserva a meta digitada", () => {
    const venda = salePriceFromMarkup(80, 25) ?? 0;
    expect(computePriceMetrics(80, venda).markupPercent).toBeCloseTo(25);

    const venda2 = salePriceFromMargin(80, 20) ?? 0;
    expect(computePriceMetrics(80, venda2).marginPercent).toBeCloseTo(20);
  });

  it("margem de 100% ou mais é impossível", () => {
    expect(salePriceFromMargin(12, 100)).toBeNull();
    expect(salePriceFromMargin(12, 150)).toBeNull();
    expect(salePriceFromMargin(12, 99)).toBe(1200);
  });

  it("markup sem custo não tem base", () => {
    expect(salePriceFromMarkup(0, 25)).toBeNull();
    expect(salePriceFromMarkup(-1, 25)).toBeNull();
  });

  it("aceita meta negativa (venda abaixo do custo)", () => {
    expect(salePriceFromProfit(12, -2)).toBe(10);
    expect(salePriceFromMarkup(12, -25)).toBe(9);
  });

  it("arredonda para 2 casas", () => {
    expect(salePriceFromMargin(10, 33)).toBe(14.93);
  });
});
