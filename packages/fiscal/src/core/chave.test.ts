import { calcMod11, generateAccessKey } from "@brasil-fiscal/core";
import { describe, expect, it } from "vitest";
import {
  ChaveError,
  TP_EMIS,
  aammDeDhEmi,
  calcularDV,
  chaveValida,
  montarChave,
  partesDaChave,
} from "./chave";

const BASE = {
  uf: "PI",
  dhEmi: "2026-08-28T16:30:00-03:00",
  cnpj: "12345678000195",
  modelo: 65,
  serie: 1,
  numero: 42,
  tpEmis: TP_EMIS.NORMAL,
  cNF: "10203040",
} as const;

describe("aammDeDhEmi", () => {
  it("usa o ano e o mês do próprio dhEmi", () => {
    expect(aammDeDhEmi("2026-08-28T16:30:00-03:00")).toBe("2608");
    expect(aammDeDhEmi("2027-01-01T00:00:00-03:00")).toBe("2701");
  });

  it("não desloca a virada do mês por causa de fuso", () => {
    // 31/08 às 21h em Teresina é 01/09 em UTC. Se o AAMM viesse de um `Date`
    // lido em UTC, a chave sairia com o mês errado e a SEFAZ rejeitaria.
    expect(aammDeDhEmi("2026-08-31T21:00:00-03:00")).toBe("2608");
  });

  it("recusa dhEmi malformado", () => {
    expect(() => aammDeDhEmi("28/08/2026")).toThrow(ChaveError);
  });
});

describe("calcularDV", () => {
  it("bate com a implementação de referência em chaves aleatórias", () => {
    // `calcMod11` do @brasil-fiscal/core é escrito de outro jeito
    // (`resto < 2 ? 0 : 11 - resto`) — se as duas concordam em 500 amostras, o
    // tratamento de resto 0 e 1 está certo nos dois.
    for (let i = 0; i < 500; i++) {
      const base = Array.from({ length: 43 }, (_, n) =>
        String((i * 7 + n * 13) % 10),
      ).join("");
      expect(calcularDV(base), base).toBe(String(calcMod11(base)));
    }
  });

  it("resto 0 e resto 1 viram DV 0, não 11 nem 10", () => {
    // É o erro clássico de emissor caseiro: `11 - resto` sem o corte.
    const zeros = "0".repeat(43);
    expect(calcularDV(zeros)).toBe("0");

    const comResto1 = acharBasePorDv((soma) => soma % 11 === 1);
    expect(calcularDV(comResto1)).toBe("0");
  });

  it("exige exatamente 43 dígitos", () => {
    expect(() => calcularDV("123")).toThrow(ChaveError);
    expect(() => calcularDV("0".repeat(44))).toThrow(ChaveError);
  });
});

describe("montarChave", () => {
  it("monta 44 dígitos com DV válido", () => {
    const chave = montarChave(BASE);
    expect(chave).toHaveLength(44);
    expect(chaveValida(chave)).toBe(true);
  });

  it("bate com a implementação de referência", () => {
    const referencia = generateAccessKey({
      uf: "22", // código IBGE do PI
      dataEmissao: new Date(2026, 7, 28), // mês 7 = agosto, hora local
      cnpj: BASE.cnpj,
      modelo: "65",
      serie: BASE.serie,
      numero: BASE.numero,
      tipoEmissao: BASE.tpEmis,
      codigoNumerico: BASE.cNF,
    });
    expect(montarChave(BASE)).toBe(referencia);
  });

  it("posiciona cada campo no lugar certo", () => {
    const partes = partesDaChave(montarChave(BASE));
    expect(partes).toMatchObject({
      uf: "PI",
      aamm: "2608",
      cnpj: "12345678000195",
      modelo: 65,
      serie: 1,
      numero: 42,
      tpEmis: 1,
      cNF: "10203040",
    });
  });

  it("marca contingência offline no tpEmis", () => {
    const chave = montarChave({
      ...BASE,
      tpEmis: TP_EMIS.CONTINGENCIA_OFFLINE_NFCE,
    });
    expect(partesDaChave(chave).tpEmis).toBe(9);
  });

  it("aceita CNPJ formatado", () => {
    expect(montarChave({ ...BASE, cnpj: "12.345.678/0001-95" })).toBe(
      montarChave(BASE),
    );
  });

  it("recusa cNF igual ao nNF", () => {
    // Rejeição da SEFAZ (NT 2019.001). Fácil de produzir sem querer se alguém
    // "derivar" o cNF do número da nota em vez de sortear.
    expect(() =>
      montarChave({ ...BASE, numero: 10203040, cNF: "10203040" }),
    ).toThrow(/cNF não pode ser igual/);
  });

  it("recusa CNPJ e cNF com tamanho errado", () => {
    expect(() => montarChave({ ...BASE, cnpj: "123" })).toThrow(/14 dígitos/);
    expect(() => montarChave({ ...BASE, cNF: "123" })).toThrow(/8 dígitos/);
  });

  it("recusa série e número fora da faixa do layout", () => {
    expect(() => montarChave({ ...BASE, serie: 1000 })).toThrow(/Série/);
    expect(() => montarChave({ ...BASE, numero: 0 })).toThrow(/Número/);
    expect(() => montarChave({ ...BASE, numero: 1_000_000_000 })).toThrow(
      /Número/,
    );
  });
});

describe("chaveValida", () => {
  it("recusa chave com DV trocado", () => {
    const chave = montarChave(BASE);
    const dvErrado = String((Number(chave[43]) + 1) % 10);
    expect(chaveValida(chave.slice(0, 43) + dvErrado)).toBe(false);
  });

  it("recusa tamanho e caracteres inválidos", () => {
    expect(chaveValida("123")).toBe(false);
    expect(chaveValida(`${"1".repeat(43)}X`)).toBe(false);
  });
});

describe("partesDaChave", () => {
  it("devolve uf nula para código IBGE inexistente", () => {
    // Chave adulterada não deve estourar no roteamento — só não resolve a UF.
    const chave = `99${montarChave(BASE).slice(2)}`;
    expect(partesDaChave(chave).uf).toBeNull();
  });

  it("recusa entrada que não tem 44 dígitos", () => {
    expect(() => partesDaChave("123")).toThrow(ChaveError);
  });
});

/** Procura uma base de 43 dígitos cuja soma ponderada satisfaça o predicado. */
function acharBasePorDv(predicado: (soma: number) => boolean): string {
  for (let n = 0; n < 10_000; n++) {
    const base = String(n).padStart(43, "0");
    let soma = 0;
    let peso = 2;
    for (let i = 42; i >= 0; i--) {
      soma += Number(base[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    if (predicado(soma)) return base;
  }
  throw new Error("nenhuma base encontrada");
}
