import { describe, expect, it } from "vitest";
import { pareceIdentificador, percentualDeBlocos } from "./perfilar-coluna";

describe("percentualDeBlocos", () => {
  it("lê inteira a tabela pequena ou sem estatística", () => {
    expect(percentualDeBlocos(24_092)).toBeNull();
    expect(percentualDeBlocos(300_000)).toBeNull();
    expect(percentualDeBlocos(null)).toBeNull();
  });

  it("mira ~300 mil linhas em tabela grande", () => {
    // PCPEDI do Armazém: 17 mi de linhas → ~1,77% dos blocos.
    expect(percentualDeBlocos(16_993_357)).toBeCloseTo(1.7654, 3);
    expect(percentualDeBlocos(10_000_000_000)).toBe(0.01);
  });
});

describe("pareceIdentificador", () => {
  it("marca coluna em que quase todo valor é único", () => {
    expect(pareceIdentificador(1_000, 995)).toBe(true);
    expect(pareceIdentificador(1_000, 40)).toBe(false);
    // Poucas linhas não bastam para concluir.
    expect(pareceIdentificador(10, 10)).toBe(false);
  });
});
