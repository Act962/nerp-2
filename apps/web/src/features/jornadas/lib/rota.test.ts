import { describe, expect, it } from "vitest";
import { casaRota, normalizarRota } from "./rota";

describe("casaRota", () => {
  it("ignora a barra final", () => {
    expect(casaRota("/produtos", "/produtos/")).toBe(true);
    expect(casaRota("/produtos/", "/produtos")).toBe(true);
  });

  it("ignora a query — um filtro no meio não derruba a jornada", () => {
    expect(casaRota("/produtos", "/produtos?busca=arroz")).toBe(true);
  });

  it("não casa tela diferente", () => {
    expect(casaRota("/produtos", "/produtos/novo")).toBe(false);
    expect(casaRota("/produtos", "/clientes")).toBe(false);
  });

  it("sem rota esperada, qualquer tela serve", () => {
    expect(casaRota(undefined, "/qualquer")).toBe(true);
  });

  it("a raiz continua sendo a raiz", () => {
    expect(normalizarRota("/")).toBe("/");
  });
});
