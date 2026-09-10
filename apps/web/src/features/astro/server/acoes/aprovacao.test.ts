import { describe, expect, it } from "vitest";
import {
  ACOES_QUE_PEDEM_APROVACAO,
  CONFIGURACAO_DE_APROVACAO,
  ROTULO_DA_ACAO,
} from "./aprovacao";

describe("aprovação das ações", () => {
  it("toda ação de escrita pede o sim da pessoa", () => {
    for (const acao of ACOES_QUE_PEDEM_APROVACAO) {
      expect(CONFIGURACAO_DE_APROVACAO[acao], acao).toBe("user-approval");
    }
    expect(Object.keys(CONFIGURACAO_DE_APROVACAO)).toHaveLength(
      ACOES_QUE_PEDEM_APROVACAO.length,
    );
  });

  it("toda ação tem rótulo e resumo — o cartão nunca sai sem texto", () => {
    for (const acao of ACOES_QUE_PEDEM_APROVACAO) {
      const rotulo = ROTULO_DA_ACAO[acao];
      expect(rotulo?.titulo, acao).toBeTruthy();
      expect(rotulo?.resumir({}), acao).toBeTruthy();
    }
  });

  it("o resumo do disparo avisa que a mensagem sai de verdade", () => {
    const resumo = ROTULO_DA_ACAO.enviarCampanhaWhatsapp.resumir({
      template: "oferta_semana",
    });
    expect(resumo).toMatch(/de verdade/i);
    expect(resumo).toContain("oferta_semana");
    expect(ROTULO_DA_ACAO.enviarCampanhaWhatsapp.titulo).toMatch(/DISPARAR/);
  });

  it("resumo aguenta entrada faltando, sem quebrar o cartão", () => {
    expect(ROTULO_DA_ACAO.criarCatalogoPromocional.resumir({})).toContain(
      "Sem nome",
    );
    expect(
      ROTULO_DA_ACAO.criarEventoNoCalendario.resumir({ titulo: 42 }),
    ).toContain("Sem título");
  });
});
