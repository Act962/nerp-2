import { describe, expect, it } from "vitest";
import {
  ehLeituraRepetida,
  NENHUMA_LEITURA,
  SCAN_DEDUPE_MS,
} from "./scan-dedupe";

describe("ehLeituraRepetida", () => {
  it("nada a repetir quando ainda não houve leitura", () => {
    expect(ehLeituraRepetida(NENHUMA_LEITURA, "003754", 1000)).toBe(false);
  });

  it("descarta a releitura do mesmo código dentro da janela", () => {
    const ultima = { code: "003754", at: 1000 };
    expect(ehLeituraRepetida(ultima, "003754", 1000 + 300)).toBe(true);
  });

  // A segunda unidade DE PROPÓSITO tem de passar: afastar o item e reaproximar
  // leva mais que a janela. É o caso que o cliente relatou como quebrado.
  it("aceita o mesmo código depois da janela", () => {
    const ultima = { code: "003754", at: 1000 };
    expect(ehLeituraRepetida(ultima, "003754", 1000 + SCAN_DEDUPE_MS)).toBe(
      false,
    );
    expect(ehLeituraRepetida(ultima, "003754", 1000 + 2000)).toBe(false);
  });

  it("não atrapalha o produto seguinte lido logo em seguida", () => {
    const ultima = { code: "003754", at: 1000 };
    expect(ehLeituraRepetida(ultima, "002203", 1000 + 50)).toBe(false);
  });
});
