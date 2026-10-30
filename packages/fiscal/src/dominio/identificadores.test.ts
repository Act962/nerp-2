import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfValido,
  documentoValido,
  gtinValido,
} from "./identificadores";

describe("identificadores", () => {
  it("CPF: aceita válido com ou sem máscara e recusa DV errado e repetidos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });

  it("CNPJ: aceita válido e recusa DV errado e repetidos", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });

  it("documentoValido escolhe CPF ou CNPJ pelo tamanho", () => {
    expect(documentoValido("52998224725")).toBe(true);
    expect(documentoValido("11222333000181")).toBe(true);
    expect(documentoValido("1122233300018")).toBe(false);
  });

  it("GTIN: confere o dígito de EAN-13, EAN-8, UPC-12 e GTIN-14", () => {
    expect(gtinValido("4006381333931")).toBe(true);
    expect(gtinValido("4006381333932")).toBe(false);
    expect(gtinValido("96385074")).toBe(true);
    expect(gtinValido("036000291452")).toBe(true);
    expect(gtinValido("10012345678902")).toBe(true);
    expect(gtinValido("123")).toBe(false);
    expect(gtinValido("SEM GTIN")).toBe(false);
  });
});
