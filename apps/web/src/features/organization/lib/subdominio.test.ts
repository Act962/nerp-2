import { describe, expect, it } from "vitest";
import { validarSubdominio } from "./subdominio";

describe("validarSubdominio", () => {
  it("aceita um rótulo DNS comum e normaliza para minúsculas", () => {
    expect(validarSubdominio("  Gotham  ")).toEqual({
      ok: true,
      subdominio: "gotham",
    });
    expect(validarSubdominio("loja-do-joao2").ok).toBe(true);
  });

  it("rejeita reservados, mesmo em maiúsculas", () => {
    for (const nome of ["www", "ADMIN", "api", "login", "nerp", "orbita"]) {
      const resultado = validarSubdominio(nome);
      expect(resultado.ok, nome).toBe(false);
    }
  });

  it("rejeita tamanho fora de 3..63", () => {
    expect(validarSubdominio("ab").ok).toBe(false);
    expect(validarSubdominio("a".repeat(64)).ok).toBe(false);
    expect(validarSubdominio("a".repeat(63)).ok).toBe(true);
  });

  it("rejeita hífen nas pontas, espaço, acento e ponto", () => {
    for (const nome of ["-loja", "loja-", "lo ja", "açaí", "loja.x", "a_b"]) {
      expect(validarSubdominio(nome).ok, nome).toBe(false);
    }
  });
});
