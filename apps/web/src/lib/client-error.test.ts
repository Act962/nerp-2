import { describe, expect, it } from "vitest";
import { isChunkLoadError, tryReloadOnce } from "./client-error";

function erro(message: string, name?: string) {
  const e = new Error(message);
  if (name) e.name = name;
  return e;
}

describe("isChunkLoadError", () => {
  // As variantes que webpack, Turbopack e o próprio navegador emitem para a
  // MESMA situação: o chunk pedido não existe mais depois de um deploy.
  it("reconhece as mensagens de chunk perdido", () => {
    expect(isChunkLoadError(erro("qualquer coisa", "ChunkLoadError"))).toBe(
      true,
    );
    expect(isChunkLoadError(erro("Loading chunk 429 failed."))).toBe(true);
    expect(isChunkLoadError(erro("Loading CSS chunk 12 failed"))).toBe(true);
    expect(
      isChunkLoadError(
        erro("Failed to fetch dynamically imported module: /_next/x.js"),
      ),
    ).toBe(true);
    expect(isChunkLoadError(erro("Importing a module script failed."))).toBe(
      true,
    );
  });

  it("não confunde com erro de aplicação", () => {
    expect(isChunkLoadError(erro("Cannot read properties of undefined"))).toBe(
      false,
    );
    expect(isChunkLoadError(erro("NOT_FOUND: Produto não encontrado"))).toBe(
      false,
    );
  });

  it("aguenta o que não é Error", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("Loading chunk 1 failed")).toBe(false);
    expect(isChunkLoadError({ message: "Loading chunk 1 failed" })).toBe(false);
  });
});

describe("tryReloadOnce", () => {
  // Roda no projeto de unidade (Node): sem window, não pode explodir nem
  // fingir que recarregou.
  it("não faz nada fora do navegador", () => {
    expect(tryReloadOnce()).toBe(false);
  });
});
