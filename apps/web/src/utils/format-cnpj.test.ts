import { describe, expect, it } from "vitest";
import { formatCNPJ, formatCPForCNPJ, unformatCNPJ } from "./format-cnpj";

// Molde para teste unitário: função pura, sem DB, sem React, sem env.
describe("formatCNPJ", () => {
  it("formata um CNPJ completo", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formata parcialmente enquanto o usuário digita", () => {
    expect(formatCNPJ("11")).toBe("11");
    expect(formatCNPJ("11222")).toBe("11.222");
    expect(formatCNPJ("11222333")).toBe("11.222.333");
  });

  it("descarta o que passar de 14 dígitos", () => {
    expect(formatCNPJ("112223330001819999")).toBe("11.222.333/0001-81");
  });

  it("ignora caracteres que já vieram formatados", () => {
    expect(formatCNPJ("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });
});

describe("unformatCNPJ", () => {
  it("devolve só os dígitos", () => {
    expect(unformatCNPJ("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("formatCPForCNPJ", () => {
  it("usa máscara de CPF até 11 dígitos", () => {
    expect(formatCPForCNPJ("12345678909")).toBe("123.456.789-09");
  });

  it("vira máscara de CNPJ a partir do 12º dígito", () => {
    expect(formatCPForCNPJ("112223330001")).toBe("11.222.333/0001");
  });

  it("devolve string vazia para valor ausente", () => {
    expect(formatCPForCNPJ(undefined as unknown as string)).toBe("");
  });
});
