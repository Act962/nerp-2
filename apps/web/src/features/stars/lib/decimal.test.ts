import { describe, expect, it } from "vitest";
import {
  arredondarEstrelas,
  emEstrelas,
  formatarEstrelas,
  lerEstrelasDigitadas,
} from "./decimal";

/**
 * ★ com fração é dinheiro. O que se garante aqui é que o número que sai do
 * banco, o que a pessoa digita e o que vira débito são o MESMO número.
 */

describe("emEstrelas", () => {
  it("aceita o Decimal do Prisma, número e a string do driver", () => {
    expect(emEstrelas({ toNumber: () => 0.2 })).toBe(0.2);
    expect(emEstrelas(3)).toBe(3);
    // `numeric` volta do node-postgres como string.
    expect(emEstrelas("12.34")).toBe(12.34);
  });

  it("nulo, indefinido e lixo viram zero — nunca NaN", () => {
    expect(emEstrelas(null)).toBe(0);
    expect(emEstrelas(undefined)).toBe(0);
    expect(emEstrelas("coisa nenhuma")).toBe(0);
  });
});

describe("arredondarEstrelas", () => {
  it("guarda duas casas", () => {
    expect(arredondarEstrelas(0.239)).toBe(0.24);
    expect(arredondarEstrelas(0.2)).toBe(0.2);
    expect(arredondarEstrelas(5)).toBe(5);
  });

  it("não deixa o ponto flutuante estragar o extrato", () => {
    // 0,1 + 0,2 é 0,30000000000000004 em ponto flutuante. Sem o arredondamento
    // o mesmo débito gravaria 0,3 numa hora e 0,29 noutra.
    expect(arredondarEstrelas(0.1 + 0.2)).toBe(0.3);
    expect(arredondarEstrelas(1.005)).toBe(1.01);
  });

  it("valor impossível vira zero em vez de NaN no saldo", () => {
    expect(arredondarEstrelas(Number.NaN)).toBe(0);
    expect(arredondarEstrelas(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("lerEstrelasDigitadas", () => {
  it("aceita vírgula, que é como se digita em português", () => {
    expect(lerEstrelasDigitadas("0,2")).toBe(0.2);
    expect(lerEstrelasDigitadas("0.2")).toBe(0.2);
    expect(lerEstrelasDigitadas(" 1,5 ")).toBe(1.5);
  });

  it("zero é válido: é assim que se desliga a cobrança", () => {
    expect(lerEstrelasDigitadas("0")).toBe(0);
  });

  it("vazio e lixo devolvem nulo, e NÃO zero", () => {
    // A diferença importa: zero DESLIGARIA a cobrança daquela ação sem
    // ninguém pedir. Nulo trava o botão e mostra o erro.
    expect(lerEstrelasDigitadas("")).toBeNull();
    expect(lerEstrelasDigitadas("abc")).toBeNull();
    expect(lerEstrelasDigitadas("-1")).toBeNull();
  });
});

describe("formatarEstrelas", () => {
  it("inteiro sai sem casas, fração sai com duas", () => {
    expect(formatarEstrelas(5)).toBe("5");
    expect(formatarEstrelas(0.2)).toBe("0,20");
    expect(formatarEstrelas({ toNumber: () => 1.5 })).toBe("1,50");
  });
});
