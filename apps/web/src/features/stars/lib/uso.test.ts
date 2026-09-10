import { describe, expect, it } from "vitest";
import { calcularUso, custoDeTokens } from "./uso";

describe("calcularUso", () => {
  it("plano cheio, nada consumido", () => {
    const uso = calcularUso({ saldo: 50, limite: 50, consumido: 0 });
    expect(uso.percentual).toBe(0);
    expect(uso.usoExtra).toBe(0);
    expect(uso.restanteDoPlano).toBe(50);
    expect(uso.nivel).toBe("ok");
  });

  it("consumo vira percentual: 300 de 1.000 é 30%", () => {
    const uso = calcularUso({ saldo: 700, limite: 1000, consumido: 300 });
    expect(uso.percentual).toBe(30);
    expect(uso.restanteDoPlano).toBe(700);
    expect(uso.nivel).toBe("ok");
  });

  it("laranja quando sobra 30% ou menos; vermelho com 10% ou menos", () => {
    expect(calcularUso({ saldo: 15, limite: 50, consumido: 35 }).nivel).toBe(
      "atencao",
    );
    expect(calcularUso({ saldo: 5, limite: 50, consumido: 45 }).nivel).toBe(
      "critico",
    );
  });

  it("zerou: esgotado, percentual capado em 100", () => {
    const uso = calcularUso({ saldo: 0, limite: 50, consumido: 50 });
    expect(uso.nivel).toBe("esgotado");
    expect(uso.percentual).toBe(100);
  });

  it("passou do plano: uso extra é o excedente e o percentual não passa de 100", () => {
    const uso = calcularUso({ saldo: 20, limite: 50, consumido: 80 });
    expect(uso.usoExtra).toBe(30);
    expect(uso.percentual).toBe(100);
    expect(uso.restanteDoPlano).toBe(0);
  });

  it("Stars avulsas no bolso não deixam a org vermelha só por ter gasto o plano", () => {
    const uso = calcularUso({ saldo: 450, limite: 50, consumido: 50 });
    expect(uso.percentual).toBe(100);
    expect(uso.nivel).toBe("ok");
  });

  it("plano sem ★ (limite 0): só o saldo decide", () => {
    expect(calcularUso({ saldo: 0, limite: 0, consumido: 0 }).nivel).toBe(
      "esgotado",
    );
    const comSaldo = calcularUso({ saldo: 3, limite: 0, consumido: 10 });
    expect(comSaldo.nivel).toBe("ok");
    expect(comSaldo.percentual).toBe(0);
  });

  it("nunca devolve número negativo", () => {
    const uso = calcularUso({ saldo: -5, limite: -1, consumido: -3 });
    expect(uso.saldo).toBe(0);
    expect(uso.limite).toBe(0);
    expect(uso.consumido).toBe(0);
  });
});

describe("custoDeTokens", () => {
  it("cobra por bloco de mil, arredondando para cima", () => {
    expect(custoDeTokens(1, 1)).toBe(1);
    expect(custoDeTokens(1000, 1)).toBe(1);
    expect(custoDeTokens(1001, 1)).toBe(2);
    expect(custoDeTokens(4500, 2)).toBe(10);
  });

  it("zero tokens ou preço zero não custa nada", () => {
    expect(custoDeTokens(0, 1)).toBe(0);
    expect(custoDeTokens(999, 0)).toBe(0);
  });
});
