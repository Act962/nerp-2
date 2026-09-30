import { describe, expect, it } from "vitest";
import { capitalizarPalavras } from "./capitalizar";

describe("capitalizarPalavras", () => {
  it("padroniza o que vem em caixa alta ou baixa", () => {
    expect(capitalizarPalavras("BOX")).toBe("Box");
    expect(capitalizarPalavras("Arranjos florais")).toBe("Arranjos Florais");
    expect(capitalizarPalavras("PELÚCIAS")).toBe("Pelúcias");
  });

  it("mantém os conectivos em minúscula, menos no começo", () => {
    expect(capitalizarPalavras("COROAS DE FLORES E PLANTAS")).toBe(
      "Coroas de Flores e Plantas",
    );
    expect(capitalizarPalavras("de tudo um pouco")).toBe("De Tudo Um Pouco");
  });

  it("preserva as quebras de linha", () => {
    expect(capitalizarPalavras("OFERTA\nDO DIA")).toBe("Oferta\ndo Dia");
  });
});
