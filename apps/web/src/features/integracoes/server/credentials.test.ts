import { describe, expect, it } from "vitest";
import { mascarar, sanitizarErro } from "./credentials";

describe("mascarar", () => {
  it("mostra só os quatro últimos dígitos", () => {
    expect(mascarar("abcdef123456")).toBe("••••3456");
  });

  it("não vaza nada de segredo curto", () => {
    expect(mascarar("123")).toBe("••••");
    expect(mascarar("1234")).toBe("••••");
  });
});

describe("sanitizarErro", () => {
  it("tira o segredo que o provedor devolveu na mensagem", () => {
    const mensagem = sanitizarErro(
      "401 invalid client_secret: s3gr3d0-muito-secreto",
      ["s3gr3d0-muito-secreto"],
    );
    expect(mensagem).not.toContain("s3gr3d0-muito-secreto");
    expect(mensagem).toContain("••••");
  });

  it("tira token de autorização que não estava na nossa lista", () => {
    const mensagem = sanitizarErro(
      "request failed: Bearer eyJhbGciOiJIUzI1NiJ9.abc-123",
      [],
    );
    expect(mensagem).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(mensagem).toBe("request failed: Bearer ••••");
  });

  it("ignora segredo curto para não embaralhar a mensagem inteira", () => {
    expect(sanitizarErro("erro ao conectar", ["erro"])).toBe(
      "erro ao conectar",
    );
  });

  it("corta mensagem longa demais para caber em lastSyncError", () => {
    expect(sanitizarErro("x".repeat(500), []).length).toBe(300);
  });
});
