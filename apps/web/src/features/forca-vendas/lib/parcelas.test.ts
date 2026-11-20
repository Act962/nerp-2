import { describe, expect, it } from "vitest";
import { descreverPrazos, dividirEmParcelas } from "./parcelas";

const FATURADO = new Date("2026-10-16T12:00:00.000Z");

describe("dividirEmParcelas", () => {
  it("o resto dos centavos vai para a última parcela", () => {
    const parcelas = dividirEmParcelas(100, [28, 35, 42], FATURADO);
    expect(parcelas.map((parcela) => parcela.valor)).toEqual([
      33.33, 33.33, 33.34,
    ]);
  });

  it("vencimento é o faturamento mais o prazo", () => {
    const [parcela] = dividirEmParcelas(50, [28], FATURADO);
    expect(parcela.vencimento.getTime() - FATURADO.getTime()).toBe(
      28 * 24 * 60 * 60 * 1000,
    );
  });

  it("sem prazos é à vista", () => {
    const parcelas = dividirEmParcelas(10, [], FATURADO);
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].vencimento).toEqual(FATURADO);
  });
});

describe("descreverPrazos", () => {
  it("descreve à vista e a prazo", () => {
    expect(descreverPrazos([0])).toBe("À vista");
    expect(descreverPrazos([28, 35, 42])).toBe("28/35/42 dias");
  });
});
