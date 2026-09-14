import { describe, expect, it } from "vitest";
import { encodeText } from "./encoding";

describe("encodeText", () => {
  it("passa ASCII sem tocar", () => {
    expect(encodeText("TOTAL R$ 10,00", "CP860")).toEqual(
      [..."TOTAL R$ 10,00"].map((c) => c.charCodeAt(0)),
    );
  });

  it("mapeia os acentos do português na CP860", () => {
    // Açaí — cada acento tem posição própria na tabela portuguesa.
    expect(encodeText("Açaí", "CP860")).toEqual([0x41, 0x87, 0x61, 0xa1]);
    expect(encodeText("ã", "CP860")).toEqual([0x84]);
    expect(encodeText("õ", "CP860")).toEqual([0x94]);
  });

  it("CP850 e CP860 divergem onde devem", () => {
    expect(encodeText("ã", "CP850")).not.toEqual(encodeText("ã", "CP860"));
    // ç e é são iguais nas duas — é o que permite CP850 como alternativa.
    expect(encodeText("ç", "CP850")).toEqual(encodeText("ç", "CP860"));
  });

  it("nunca emite byte solto para caractere fora da tabela", () => {
    const bytes = encodeText("日本", "CP860");
    expect(bytes).toEqual([0x3f, 0x3f]);
  });

  it("tira o acento antes de desistir", () => {
    // CP437 não tem "ã" próprio; o texto ainda sai legível.
    const bytes = encodeText("ã", "CP437");
    expect(bytes).not.toEqual([0x3f]);
  });

  it("imprime os símbolos tipográficos dos textos padrão do editor", () => {
    // "Venda {{numero}} · {{data}}" é o preset não fiscal: sem o ponto do meio
    // o cupom saía com um "?" no meio da primeira linha.
    expect(encodeText("·", "CP860")).toEqual([0xfa]);
    expect(encodeText("·", "CP850")).toEqual([0xfa]);
    // Travessão e reticências não existem em tabela nenhuma: caem no ASCII.
    expect(encodeText("—", "CP860")).toEqual([0x2d]);
    expect(encodeText("…", "CP860")).toEqual([0x2e, 0x2e, 0x2e]);
  });

  it("preserva a quebra de linha", () => {
    expect(encodeText("a\nb", "CP860")).toEqual([0x61, 0x0a, 0x62]);
  });
});
