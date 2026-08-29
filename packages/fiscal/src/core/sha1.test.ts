import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha1Base64, sha1Hex, toBase64, utf8Bytes } from "./sha1";

/**
 * Vetores oficiais do RFC 3174 / FIPS 180-1. São a única forma de provar que a
 * implementação própria é a mesma coisa que `node:crypto` — que não pode ser
 * usado aqui porque este módulo roda na webview do Tauri.
 */
const VETORES: Array<[string, string]> = [
  ["", "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709"],
  ["abc", "A9993E364706816ABA3E25717850C26C9CD0D89D"],
  [
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "84983E441C3BD26EBAAE4AA1F95129E5E54670F1",
  ],
];

describe("sha1Hex", () => {
  it.each(VETORES)("vetor oficial: %j", (entrada, esperado) => {
    expect(sha1Hex(entrada)).toBe(esperado);
  });

  it("vetor de 1.000.000 de 'a' (exercita múltiplos blocos)", () => {
    expect(sha1Hex("a".repeat(1_000_000))).toBe(
      "34AA973CD4C4DAA4F61EEB2BDBAD27316534016F",
    );
  });

  it("bate com node:crypto em entradas variadas", () => {
    // O oráculo mais forte disponível: se divergir do OpenSSL do Node em
    // qualquer tamanho, a implementação está errada.
    for (const tamanho of [1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
      const entrada = "x".repeat(tamanho);
      expect(sha1Hex(entrada), `tamanho ${tamanho}`).toBe(
        createHash("sha1").update(entrada).digest("hex").toUpperCase(),
      );
    }
  });

  it("trata acento como UTF-8, não como latin-1", () => {
    // Razão social com acento entra no XML; errar a codificação muda o hash.
    const entrada = "AÇÃO LTDA";
    expect(sha1Hex(entrada)).toBe(
      createHash("sha1").update(entrada, "utf8").digest("hex").toUpperCase(),
    );
  });

  it("aceita bytes crus além de string", () => {
    const bytes = utf8Bytes("abc");
    expect(sha1Hex(bytes)).toBe(sha1Hex("abc"));
  });
});

describe("sha1Base64", () => {
  it("é o formato do DigestValue da assinatura", () => {
    expect(sha1Base64("abc")).toBe(
      createHash("sha1").update("abc").digest("base64"),
    );
  });

  it("bate com node:crypto na fronteira de padding do base64", () => {
    for (const entrada of ["", "a", "ab", "abc", "abcd"])
      expect(sha1Base64(entrada), entrada).toBe(
        createHash("sha1").update(entrada).digest("base64"),
      );
  });
});

describe("toBase64", () => {
  it("codifica bytes altos sem corromper (não é latin-1 ingênuo)", () => {
    const bytes = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
