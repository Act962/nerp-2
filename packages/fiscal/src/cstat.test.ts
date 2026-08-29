import { describe, expect, it } from "vitest";
import {
  autorizada,
  cStatInfo,
  classificar,
  deveConsultar,
  deveRetentar,
  resultadoConsulta,
} from "./cstat";

describe("classificar", () => {
  it("autorização é ok", () => {
    expect(classificar(100)).toBe("ok");
    expect(classificar(150)).toBe("ok");
    expect(autorizada(100)).toBe(true);
  });

  it("serviço paralisado é retry — o XML pode ser reenviado igual", () => {
    expect(classificar(108)).toBe("retry");
    expect(classificar(109)).toBe("retry");
    expect(deveRetentar(109)).toBe(true);
  });

  it("consumo indevido é retry, não rejeição", () => {
    // Bloqueio temporário por excesso de chamadas: reenviar depois resolve.
    expect(classificar(656)).toBe("retry");
  });

  it("duplicidade manda CONSULTAR, nunca reenviar", () => {
    // É o guard contra nota duplicada: 204 e 539 significam que a SEFAZ pode
    // já ter a nota. Reenviar aqui emite a mesma venda duas vezes.
    expect(classificar(204)).toBe("consult");
    expect(classificar(539)).toBe("consult");
    expect(deveConsultar(539)).toBe(true);
    expect(deveRetentar(539)).toBe(false);
  });

  it("rejeição de conteúdo é fatal", () => {
    for (const codigo of [225, 236, 297, 464, 474, 496, 610])
      expect(classificar(codigo), String(codigo)).toBe("fatal");
  });

  it("código desconhecido cai em fatal, não em retry", () => {
    // Escolha deliberada: retentar um código que não conhecemos pode duplicar
    // nota; tratar como rejeição só exige alguém olhar.
    expect(classificar(987)).toBe("fatal");
    expect(classificar(0)).toBe("fatal");
  });

  it("faixa 1xx desconhecida é tratada como sucesso", () => {
    expect(classificar(139)).toBe("ok");
  });

  it("expõe descrição legível dos códigos catalogados", () => {
    expect(cStatInfo(539)?.descricao).toMatch(/duplicidade/i);
    expect(cStatInfo(987)).toBeNull();
  });
});

describe("resultadoConsulta", () => {
  it("217 significa que a nota NÃO existe na SEFAZ", () => {
    // O caso decisivo do fluxo pós-timeout: aqui é seguro reenviar.
    expect(resultadoConsulta(217)).toBe("inexistente");
  });

  it("100 e 150 confirmam autorização", () => {
    expect(resultadoConsulta(100)).toBe("autorizada");
    expect(resultadoConsulta(150)).toBe("autorizada");
  });

  it("distingue cancelada e denegada", () => {
    expect(resultadoConsulta(101)).toBe("cancelada");
    expect(resultadoConsulta(110)).toBe("denegada");
    expect(resultadoConsulta(302)).toBe("denegada");
  });

  it("o que não conhece fica indefinido, para não decidir errado sozinho", () => {
    expect(resultadoConsulta(999)).toBe("indefinido");
  });

  it("217 tem significados opostos em emissão e em consulta", () => {
    // A razão de existirem duas funções em vez de uma tabela só.
    expect(classificar(217)).toBe("fatal");
    expect(resultadoConsulta(217)).toBe("inexistente");
  });
});
