import { describe, expect, it } from "vitest";
import { BASE_PADRAO, converterTokensEmEstrelas } from "./conversor-de-tokens";

/**
 * A calculadora não grava nada, mas o número que ela mostra vira preço. Um
 * erro de fator de mil aqui não quebra teste nenhum do sistema — só aparece
 * na fatura.
 */

describe("converterTokensEmEstrelas", () => {
  it("faz a conta do provedor até a ★, com os fatores certos", () => {
    // US$ 1 por milhão, tudo entrada: mil tokens custam US$ 0,001.
    // A R$ 5 o dólar → R$ 0,005. A R$ 0,10 a ★ → 0,05 ★. Sem margem.
    const r = converterTokensEmEstrelas({
      preco: { entradaPorMilhao: 1, saidaPorMilhao: 1 },
      dolar: 5,
      realPorEstrela: 0.1,
      margem: 1,
      proporcaoDeSaida: 0,
    });
    expect(r.custoDolarPorMil).toBeCloseTo(0.001, 10);
    expect(r.custoRealPorMil).toBeCloseTo(0.005, 10);
    expect(r.estrelasPorMil).toBeCloseTo(0.05, 10);
    expect(r.estrelasPorCem).toBeCloseTo(0.005, 10);
  });

  it("a margem multiplica só o preço, não o custo", () => {
    const base = {
      preco: { entradaPorMilhao: 1, saidaPorMilhao: 1 },
      dolar: 5,
      realPorEstrela: 0.1,
      margem: 3,
      proporcaoDeSaida: 0,
    };
    const r = converterTokensEmEstrelas(base);
    expect(r.custoRealPorMil).toBeCloseTo(0.005, 10);
    expect(r.estrelasPorMil).toBeCloseTo(0.15, 10);
  });

  it("saída cara pesa conforme a proporção informada", () => {
    const comum = {
      dolar: 1,
      realPorEstrela: 1,
      margem: 1,
      preco: { entradaPorMilhao: 0, saidaPorMilhao: 10 },
    };
    const soEntrada = converterTokensEmEstrelas({
      ...comum,
      proporcaoDeSaida: 0,
    });
    const metade = converterTokensEmEstrelas({
      ...comum,
      proporcaoDeSaida: 0.5,
    });
    const soSaida = converterTokensEmEstrelas({
      ...comum,
      proporcaoDeSaida: 1,
    });

    expect(soEntrada.custoDolarPorMil).toBe(0);
    expect(metade.custoDolarPorMil).toBeCloseTo(soSaida.custoDolarPorMil / 2);
  });

  it("proporção fora de 0–1 é contida, não estoura a conta", () => {
    const acima = converterTokensEmEstrelas({
      ...BASE_PADRAO,
      proporcaoDeSaida: 5,
    });
    const cheia = converterTokensEmEstrelas({
      ...BASE_PADRAO,
      proporcaoDeSaida: 1,
    });
    expect(acima.custoDolarPorMil).toBeCloseTo(cheia.custoDolarPorMil, 10);
  });

  it("★ valendo zero não divide por zero", () => {
    const r = converterTokensEmEstrelas({
      ...BASE_PADRAO,
      realPorEstrela: 0,
    });
    expect(r.estrelasPorMil).toBe(0);
    expect(r.tokensPorEstrela).toBe(0);
  });

  it("diz quantos tokens uma ★ compra", () => {
    const r = converterTokensEmEstrelas({
      preco: { entradaPorMilhao: 1, saidaPorMilhao: 1 },
      dolar: 5,
      realPorEstrela: 0.1,
      margem: 1,
      proporcaoDeSaida: 0,
    });
    // 0,05 ★ por mil tokens → uma ★ compra 20 mil.
    expect(r.tokensPorEstrela).toBe(20_000);
  });
});
