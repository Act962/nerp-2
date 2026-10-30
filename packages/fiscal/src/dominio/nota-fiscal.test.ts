import { describe, expect, it } from "vitest";
import { notaDeExemplo } from "../testes/nota-de-exemplo";
import {
  calcularTotais,
  crtDoRegime,
  formatarDhEmi,
  paraCentavos,
  ratearDesconto,
  tributosPeloPercentual,
  usaCsosn,
  valorBrutoItem,
} from "./nota-fiscal";

describe("nota fiscal", () => {
  it("calcula os totais em centavos, com troco", () => {
    const nota = notaDeExemplo({
      pagamentos: [{ forma: "DINHEIRO", valor: 5000 }],
    });
    expect(calcularTotais(nota)).toEqual({
      produtos: 4288,
      descontos: 100,
      total: 4188,
      pago: 5000,
      troco: 812,
      tributosAproximados: null,
    });
  });

  it("soma os tributos aproximados só dos itens que trazem o valor", () => {
    const base = notaDeExemplo();
    const nota = {
      ...base,
      itens: base.itens.map((item, i) => ({
        ...item,
        tributosAproximados: i === 0 ? 150 : null,
      })),
    };
    expect(calcularTotais(nota).tributosAproximados).toBe(150);
    expect(tributosPeloPercentual(4188, 4)).toBe(168);
  });

  it("arredonda o valor de produto pesado (quantidade fracionada)", () => {
    const [item] = notaDeExemplo().itens;
    // 0,755 kg × R$ 39,90 = 30,1245 → 30,12
    expect(
      valorBrutoItem({ ...item, quantidade: 0.755, valorUnitario: 3990 }),
    ).toBe(3012);
  });

  it("converte real para centavos sem erro de float", () => {
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
    expect(paraCentavos(19.99)).toBe(1999);
  });

  describe("ratearDesconto", () => {
    it("distribui proporcionalmente e fecha a soma no centavo", () => {
      const partes = ratearDesconto([1000, 1000, 1000], 100);
      expect(partes.reduce((s, v) => s + v, 0)).toBe(100);
      expect(partes).toEqual([34, 33, 33]);
    });

    it("joga o resto do arredondamento no item de maior valor", () => {
      expect(ratearDesconto([100, 900], 10)).toEqual([1, 9]);
      expect(ratearDesconto([333, 334, 333], 1)).toEqual([0, 1, 0]);
    });

    it("sem desconto, zera tudo; desconto maior que os itens é erro", () => {
      expect(ratearDesconto([500, 500], 0)).toEqual([0, 0]);
      expect(() => ratearDesconto([500], 501)).toThrow(RangeError);
    });
  });

  it("CRT e CSOSN seguem o regime", () => {
    expect(crtDoRegime("SIMPLES_NACIONAL")).toBe(1);
    expect(crtDoRegime("SIMPLES_MEI")).toBe(4);
    expect(crtDoRegime("LUCRO_PRESUMIDO")).toBe(3);
    expect(usaCsosn("SIMPLES_MEI")).toBe(true);
    expect(usaCsosn("LUCRO_REAL")).toBe(false);
  });

  it("formata dhEmi no fuso de Teresina sem virar o dia", () => {
    // 01h UTC do dia 1º ainda é 22h do dia 31 em Teresina.
    expect(formatarDhEmi(new Date("2026-11-01T01:30:00.000Z"))).toBe(
      "2026-10-31T22:30:00-03:00",
    );
  });
});
