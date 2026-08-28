import { describe, expect, it } from "vitest";
import { isSensitiveObjectKey } from "./s3-object-guard";

describe("isSensitiveObjectKey", () => {
  it("libera as imagens normais do catálogo", () => {
    for (const key of [
      "8f3c-produto.jpg",
      "banner.png",
      "catalogos/2026/capa.webp",
      "relatorio.pdf",
      "planilha.xlsx",
    ])
      expect(isSensitiveObjectKey(key), key).toBe(false);
  });

  it("bloqueia certificados legados no bucket de imagens", () => {
    // Formato real de key que a rota antiga gerava: `<uuid>-<arquivo>`.
    expect(isSensitiveObjectKey("3f1a2b4c-5d6e-certificado_loja.pfx")).toBe(
      true,
    );
    expect(isSensitiveObjectKey("cert.p12")).toBe(true);
  });

  it("bloqueia outros formatos de chave privada", () => {
    for (const key of ["a.pem", "a.key", "a.jks", "a.crt", "a.cer", "a.der"])
      expect(isSensitiveObjectKey(key), key).toBe(true);
  });

  it("ignora caixa alta e espaços", () => {
    expect(isSensitiveObjectKey("  CERTIFICADO.PFX  ")).toBe(true);
  });

  it("bloqueia o prefixo fiscal em qualquer posição", () => {
    expect(isSensitiveObjectKey("fiscal/org_1/certificates/a.bin")).toBe(true);
    expect(isSensitiveObjectKey("/fiscal/org_1/x.bin")).toBe(true);
    expect(isSensitiveObjectKey("backup/fiscal/org_1/x.bin")).toBe(true);
  });

  it("bloqueia extensão escondida atrás de query string", () => {
    expect(isSensitiveObjectKey("cert.pfx?download=1")).toBe(true);
    expect(isSensitiveObjectKey("cert.pfx#frag")).toBe(true);
  });

  it("bloqueia percent-encoding do prefixo", () => {
    expect(isSensitiveObjectKey("%66iscal/org_1/x.bin")).toBe(true);
    expect(isSensitiveObjectKey("cert%2Epfx")).toBe(true);
  });

  it("bloqueia travessia de diretório e escape inválido", () => {
    expect(isSensitiveObjectKey("../fiscal/x.bin")).toBe(true);
    expect(isSensitiveObjectKey("a%2e%2e/b")).toBe(true);
    expect(isSensitiveObjectKey("%ZZ")).toBe(true);
  });

  it("bloqueia separador do Windows no prefixo", () => {
    expect(isSensitiveObjectKey("fiscal\\org_1\\x.bin")).toBe(true);
  });
});
