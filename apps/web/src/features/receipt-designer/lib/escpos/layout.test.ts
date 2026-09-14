import { describe, expect, it } from "vitest";
import { alignLine, center, truncate, twoCols, wrap } from "./layout";

describe("twoCols", () => {
  it("preenche exatamente a largura da linha", () => {
    const linha = twoCols("Subtotal", "R$ 42,00", 32);
    expect([...linha]).toHaveLength(32);
    expect(linha.endsWith("R$ 42,00")).toBe(true);
    expect(linha.startsWith("Subtotal")).toBe(true);
  });

  it("encolhe o rótulo, nunca o valor", () => {
    const linha = twoCols(
      "Hambúrguer artesanal com cheddar e bacon",
      "R$ 38,90",
      32,
    );
    expect([...linha]).toHaveLength(32);
    expect(linha.endsWith("R$ 38,90")).toBe(true);
  });

  it("conta caracteres, não bytes — acento não come coluna", () => {
    const comAcento = twoCols("Açaí", "R$ 9,00", 32);
    const semAcento = twoCols("Acai", "R$ 9,00", 32);
    expect([...comAcento]).toHaveLength([...semAcento].length);
  });
});

describe("truncate", () => {
  it("não mexe no que já cabe", () => {
    expect(truncate("Café", 10)).toBe("Café");
  });

  it("corta em caracteres", () => {
    expect(truncate("Açaí com granola", 4)).toBe("Açaí");
  });
});

describe("center e alignLine", () => {
  it("centraliza sem estourar a linha", () => {
    const linha = center("OBRIGADO", 32);
    expect([...linha].length).toBeLessThanOrEqual(32);
    expect(linha.trim()).toBe("OBRIGADO");
  });

  it("alinha à direita encostando na borda", () => {
    const linha = alignLine("R$ 10,00", 32, "right");
    expect([...linha]).toHaveLength(32);
    expect(linha.endsWith("R$ 10,00")).toBe(true);
  });
});

describe("wrap", () => {
  it("quebra respeitando a palavra", () => {
    expect(wrap("um dois tres quatro", 9)).toEqual([
      "um dois",
      "tres",
      "quatro",
    ]);
  });

  it("parte palavra maior que a linha em vez de perdê-la", () => {
    expect(wrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("preserva a quebra de linha que o usuário digitou", () => {
    expect(wrap("linha 1\nlinha 2", 32)).toEqual(["linha 1", "linha 2"]);
  });
});
