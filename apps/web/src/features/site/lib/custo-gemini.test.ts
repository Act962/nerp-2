import { describe, expect, it } from "vitest";
import { MODELOS } from "@/features/astro/server/modelos";
import { saldoDoOrcamento, somarGastoDoProvedor } from "./custo-gemini";

/**
 * O painel do admin soma dinheiro. O que se garante aqui é que ele não invente
 * número: sessão sem modelo não vira custo, e orçamento não declarado não vira
 * barra de progresso.
 */

const LEVE = MODELOS.find((m) => m.nivel === "leve");
const PESADO = MODELOS.find((m) => m.nivel === "pesado");

describe("gasto com o provedor", () => {
  it("soma zero sem sessão nenhuma", () => {
    const gasto = somarGastoDoProvedor([], 5.5);
    expect(gasto.custoDolar).toBe(0);
    expect(gasto.custoReal).toBe(0);
    expect(gasto.sessoes).toBe(0);
  });

  it("sessão sem modelo entra nos tokens e fica fora do custo", () => {
    // É o caso das conversas anteriores a gravarmos o modelo. Atribuir um
    // preço a elas seria chutar qual modelo respondeu.
    const gasto = somarGastoDoProvedor(
      [{ modelo: null, tokensIn: 10_000, tokensOut: 2_000 }],
      5.5,
    );
    expect(gasto.tokensIn).toBe(10_000);
    expect(gasto.custoDolar).toBe(0);
    expect(gasto.semModelo).toBe(1);
  });

  it("aceita o modelo tanto pelo id quanto pelo nome", () => {
    if (!LEVE) throw new Error("a tabela precisa ter um modelo leve");
    const porId = somarGastoDoProvedor(
      [{ modelo: LEVE.id, tokensIn: 1_000, tokensOut: 1_000 }],
      5.5,
    );
    const porNome = somarGastoDoProvedor(
      [{ modelo: LEVE.nome, tokensIn: 1_000, tokensOut: 1_000 }],
      5.5,
    );
    expect(porNome.custoDolar).toBe(porId.custoDolar);
    expect(porId.semModelo).toBe(0);
  });

  it("cobra o CUSTO, sem a margem que o cliente paga", () => {
    if (!LEVE) throw new Error("a tabela precisa ter um modelo leve");
    const gasto = somarGastoDoProvedor(
      [{ modelo: LEVE.id, tokensIn: 1_000, tokensOut: 1_000 }],
      1,
    );
    // Preço de tabela por mil tokens, sem multiplicador nenhum.
    expect(gasto.custoDolar).toBeCloseTo(
      LEVE.entradaPor1k + LEVE.saidaPor1k,
      8,
    );
  });

  it("o modelo pesado custa mais que o leve pelos mesmos tokens", () => {
    if (!LEVE || !PESADO) throw new Error("a tabela precisa dos dois níveis");
    const leve = somarGastoDoProvedor(
      [{ modelo: LEVE.id, tokensIn: 5_000, tokensOut: 1_000 }],
      5.5,
    );
    const pesado = somarGastoDoProvedor(
      [{ modelo: PESADO.id, tokensIn: 5_000, tokensOut: 1_000 }],
      5.5,
    );
    expect(pesado.custoReal).toBeGreaterThan(leve.custoReal);
  });

  it("converte para real pela cotação, e cotação negativa não vira crédito", () => {
    if (!LEVE) throw new Error("a tabela precisa ter um modelo leve");
    const sessao = { modelo: LEVE.id, tokensIn: 10_000, tokensOut: 5_000 };
    const normal = somarGastoDoProvedor([sessao], 5);
    expect(normal.custoReal).toBeCloseTo(normal.custoDolar * 5, 8);
    expect(somarGastoDoProvedor([sessao], -3).custoReal).toBe(0);
  });

  it("token negativo não abate o total", () => {
    // Defensivo: `tokensIn` vem de um contador que pode ser zerado na mão.
    const gasto = somarGastoDoProvedor(
      [{ modelo: null, tokensIn: -500, tokensOut: 100 }],
      5.5,
    );
    expect(gasto.tokensIn).toBe(0);
    expect(gasto.tokensOut).toBe(100);
  });
});

describe("orçamento do mês", () => {
  it("sem orçamento declarado, não há barra", () => {
    expect(saldoDoOrcamento(120, 0)).toBeNull();
    expect(saldoDoOrcamento(120, -1)).toBeNull();
  });

  it("mostra o que resta e a fatia usada", () => {
    expect(saldoDoOrcamento(250, 1_000)).toEqual({
      restante: 750,
      percentual: 25,
    });
  });

  it("estourado, o percentual para em 100 e o restante fica negativo", () => {
    // O negativo é intencional: é quanto passou, e some se a gente limitasse.
    expect(saldoDoOrcamento(1_500, 1_000)).toEqual({
      restante: -500,
      percentual: 100,
    });
  });
});
