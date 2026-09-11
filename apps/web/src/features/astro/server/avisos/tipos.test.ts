import { describe, expect, it } from "vitest";
import {
  ehSeveridade,
  ehTipoDeAviso,
  PESO_DA_SEVERIDADE,
  pesoDaSeveridade,
  ROTULO_DO_TIPO,
  SEVERIDADES,
  TIPOS_DE_AVISO,
} from "./tipos";

/**
 * Tipo e severidade são texto no banco e lista fechada em código. O que se
 * garante aqui é que a lista e a tela não se separem, e que um valor
 * desconhecido — de uma versão futura, ou de uma linha antiga — não derrube
 * quem estiver lendo.
 */

describe("vocabulário dos avisos", () => {
  it("todo tipo tem rótulo para a central", () => {
    for (const tipo of TIPOS_DE_AVISO) {
      expect(ROTULO_DO_TIPO[tipo], tipo).toBeTruthy();
    }
    expect(Object.keys(ROTULO_DO_TIPO)).toHaveLength(TIPOS_DE_AVISO.length);
  });

  it("toda severidade tem peso, e o mais grave pesa mais", () => {
    for (const severidade of SEVERIDADES) {
      expect(PESO_DA_SEVERIDADE[severidade], severidade).toBeGreaterThan(0);
    }
    expect(PESO_DA_SEVERIDADE.alta).toBeGreaterThan(PESO_DA_SEVERIDADE.media);
    expect(PESO_DA_SEVERIDADE.media).toBeGreaterThan(PESO_DA_SEVERIDADE.baixa);
  });

  it("valor desconhecido não é tipo nem severidade, e pesa zero", () => {
    expect(ehTipoDeAviso("estoque_baixo")).toBe(true);
    expect(ehTipoDeAviso("coisa_que_nao_existe")).toBe(false);
    expect(ehSeveridade("alta")).toBe(true);
    expect(ehSeveridade("urgentíssimo")).toBe(false);
    expect(pesoDaSeveridade("urgentíssimo")).toBe(0);
    expect(pesoDaSeveridade("alta")).toBe(PESO_DA_SEVERIDADE.alta);
  });
});
