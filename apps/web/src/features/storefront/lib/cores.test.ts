import { describe, expect, it } from "vitest";
import { fundoEscuro, isHexValido, tintaSobre } from "./cores";

describe("isHexValido", () => {
  it("aceita as duas formas do hexadecimal", () => {
    expect(isHexValido("#fff")).toBe(true);
    expect(isHexValido("#00BCD4")).toBe(true);
  });

  it("recusa o que não é cor", () => {
    expect(isHexValido("")).toBe(false);
    expect(isHexValido(null)).toBe(false);
    expect(isHexValido("#20409")).toBe(false);
    expect(isHexValido("azul")).toBe(false);
  });
});

describe("tintaSobre", () => {
  it("escreve escuro no claro e claro no escuro", () => {
    expect(tintaSobre("#ffffff")).toBe("#111111");
    expect(tintaSobre("#111111")).toBe("#fafafa");
  });

  /*
    O caso que a média dos canais erra: o amarelo puro e o azul puro têm a
    mesma média (85), mas um é claro e o outro é escuro para o olho. É por isso
    que a conta é a luminância da WCAG.
  */
  it("separa amarelo de azul, que a média confundiria", () => {
    expect(tintaSobre("#ffff00")).toBe("#111111");
    expect(tintaSobre("#0000ff")).toBe("#fafafa");
  });
});

describe("fundoEscuro", () => {
  it("responde pelo mesmo corte da tinta", () => {
    expect(fundoEscuro("#1f2937")).toBe(true);
    expect(fundoEscuro("#f5f5f5")).toBe(false);
  });
});
