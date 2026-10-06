import { describe, expect, it } from "vitest";
import {
  lerAstroChatGuardado,
  lerCodigoDoAstroChat,
} from "./astro-chat-codigo";

const ORBITA = "https://orbita.nasaex.com";
const CHAVE = "ac_pk_v3xNNlLljSMra-PU";
const LINHA = `<script src="${ORBITA}/api/astro-chat/loader.js" data-key="${CHAVE}" async></script>`;

describe("lerCodigoDoAstroChat", () => {
  it("tira a chave da linha inteira, do jeito que o Órbita entrega", () => {
    expect(lerCodigoDoAstroChat(LINHA, ORBITA)).toEqual({
      ok: true,
      chave: CHAVE,
      servidor: ORBITA,
    });
  });

  it("aceita só a chave", () => {
    expect(lerCodigoDoAstroChat(`  ${CHAVE}\n`, ORBITA)).toEqual({
      ok: true,
      chave: CHAVE,
      servidor: null,
    });
  });

  it("recusa código que aponta para outro servidor", () => {
    const deFora = LINHA.replace(ORBITA, "https://exemplo.com");
    expect(lerCodigoDoAstroChat(deFora, ORBITA)).toEqual({
      ok: false,
      motivo: "outro_servidor",
    });
  });

  it("diz quando não há chave no que foi colado", () => {
    expect(lerCodigoDoAstroChat("<script></script>", ORBITA)).toEqual({
      ok: false,
      motivo: "sem_chave",
    });
  });

  it("vazio é vazio, não erro de formato", () => {
    expect(lerCodigoDoAstroChat("   ", ORBITA)).toEqual({
      ok: false,
      motivo: "vazio",
    });
  });
});

describe("lerAstroChatGuardado", () => {
  it("devolve o que foi salvo", () => {
    expect(lerAstroChatGuardado({ codigo: LINHA, chave: CHAVE })).toEqual({
      codigo: LINHA,
      chave: CHAVE,
    });
  });

  it("trata registro estragado como ausente", () => {
    expect(lerAstroChatGuardado(null)).toBeNull();
    expect(lerAstroChatGuardado({ chave: "qualquer coisa" })).toBeNull();
    expect(lerAstroChatGuardado("ac_pk_solta")).toBeNull();
  });
});
