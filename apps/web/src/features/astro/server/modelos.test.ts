import { describe, expect, it } from "vitest";
import {
  custoDaResposta,
  MARGEM,
  MODELO_DO_NIVEL,
  MODELOS,
  modeloDoNivel,
  modeloPorId,
  NIVEIS,
} from "./modelos";

/**
 * Esta tabela é a fonte do preço. Um zero a mais ou a menos aqui não quebra
 * teste nenhum do sistema — aparece na fatura, no fim do mês.
 */

const BASE = { dolar: 5, realPorEstrela: 0.1, margem: 1 };

describe("catálogo de modelos", () => {
  it("todo nível tem um modelo, e o modelo existe na tabela", () => {
    for (const nivel of NIVEIS) {
      const id = MODELO_DO_NIVEL[nivel];
      expect(id, nivel).toBeTruthy();
      expect(modeloPorId(id), `${nivel} → ${id}`).not.toBeNull();
    }
  });

  it("os preços são positivos, e a saída custa mais que a entrada", () => {
    // Vale para todo provedor sério, e um valor invertido aqui seria um erro
    // de digitação que ninguém notaria de outro jeito.
    for (const modelo of MODELOS) {
      expect(modelo.entradaPor1k, modelo.id).toBeGreaterThan(0);
      expect(modelo.saidaPor1k, modelo.id).toBeGreaterThan(modelo.entradaPor1k);
    }
  });

  it("o id não se repete", () => {
    const ids = MODELOS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nível mais alto não custa menos que o mais baixo", () => {
    const preco = (nivel: (typeof NIVEIS)[number]) => {
      const m = modeloDoNivel(nivel);
      return m.entradaPor1k + m.saidaPor1k;
    };
    expect(preco("medio")).toBeGreaterThan(preco("leve"));
    expect(preco("pesado")).toBeGreaterThanOrEqual(preco("medio"));
  });

  it("a margem é de 50%, que é a decisão de negócio", () => {
    expect(MARGEM).toBe(1.5);
  });
});

describe("custoDaResposta", () => {
  const modelo = {
    id: "teste",
    nome: "Teste",
    nivel: "leve" as const,
    entradaPor1k: 0.001,
    saidaPor1k: 0.01,
  };

  it("separa entrada de saída — a saída custa muito mais", () => {
    const soEntrada = custoDaResposta({
      modelo,
      tokensIn: 1000,
      tokensOut: 0,
      base: BASE,
    });
    const soSaida = custoDaResposta({
      modelo,
      tokensIn: 0,
      tokensOut: 1000,
      base: BASE,
    });
    expect(soEntrada.custoDolar).toBeCloseTo(0.001, 10);
    expect(soSaida.custoDolar).toBeCloseTo(0.01, 10);
  });

  it("converte para real pela cotação e para ★ pelo valor da estrela", () => {
    const r = custoDaResposta({
      modelo,
      tokensIn: 1000,
      tokensOut: 1000,
      base: BASE,
    });
    // US$ 0,011 → R$ 0,055 → 0,55 ★ (a R$ 0,10 a estrela), sem margem.
    expect(r.custoDolar).toBeCloseTo(0.011, 10);
    expect(r.custoReal).toBeCloseTo(0.055, 10);
    expect(r.estrelas).toBeCloseTo(0.55, 10);
  });

  it("a margem entra no PREÇO e não no custo", () => {
    const r = custoDaResposta({
      modelo,
      tokensIn: 1000,
      tokensOut: 1000,
      base: { ...BASE, margem: 1.5 },
    });
    expect(r.custoReal).toBeCloseTo(0.055, 10);
    expect(r.precoReal).toBeCloseTo(0.0825, 10);
    expect(r.estrelas).toBeCloseTo(0.825, 10);
  });

  it("o reajuste do provedor chega ao preço sozinho", () => {
    // É a razão de existir da tabela: dobrou lá, dobra aqui, sem ninguém
    // reajustar nada à mão.
    const antes = custoDaResposta({
      modelo,
      tokensIn: 1000,
      tokensOut: 1000,
      base: BASE,
    });
    const depois = custoDaResposta({
      modelo: {
        ...modelo,
        entradaPor1k: modelo.entradaPor1k * 2,
        saidaPor1k: modelo.saidaPor1k * 2,
      },
      tokensIn: 1000,
      tokensOut: 1000,
      base: BASE,
    });
    expect(depois.estrelas).toBeCloseTo(antes.estrelas * 2, 10);
  });

  it("não cobra por token que não existiu", () => {
    const r = custoDaResposta({
      modelo,
      tokensIn: 0,
      tokensOut: 0,
      base: BASE,
    });
    expect(r.estrelas).toBe(0);
  });

  it("token negativo não vira crédito", () => {
    const r = custoDaResposta({
      modelo,
      tokensIn: -5000,
      tokensOut: 100,
      base: BASE,
    });
    expect(r.custoDolar).toBeGreaterThan(0);
  });

  it("★ valendo zero não divide por zero", () => {
    const r = custoDaResposta({
      modelo,
      tokensIn: 1000,
      tokensOut: 1000,
      base: { ...BASE, realPorEstrela: 0 },
    });
    expect(r.estrelas).toBe(0);
  });

  it("uma resposta típica custa fração de ★, e não uma ★ inteira", () => {
    // O bloco arredondado para cima da versão anterior cobrava 1 ★ por mil
    // tokens; com preço de verdade, uma resposta comum do modelo leve fica
    // muito abaixo disso.
    const leve = modeloDoNivel("leve");
    const r = custoDaResposta({
      modelo: leve,
      tokensIn: 4000,
      tokensOut: 400,
      base: { dolar: 5.5, realPorEstrela: 0.1 },
    });
    expect(r.estrelas).toBeLessThan(1);
    expect(r.estrelas).toBeGreaterThan(0);
  });
});
