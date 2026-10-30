import { describe, expect, it } from "vitest";
import { TP_EMIS, montarChave } from "../core/chave";
import { notaDeExemplo } from "../testes/nota-de-exemplo";
import { DocumentoFiscal } from "./documento-fiscal";
import {
  ErroFiscal,
  JustificativaInvalidaError,
  TransicaoInvalidaError,
} from "./erros";

const AGORA = new Date("2026-11-03T13:00:00.000Z");

function novoDocumento(numero = 7) {
  return DocumentoFiscal.criar({
    id: "doc-1",
    organizationId: "org-1",
    saleId: "venda-1",
    serie: 1,
    numero,
    tpEmis: TP_EMIS.NORMAL,
    nota: notaDeExemplo(),
    criadoEm: AGORA,
  });
}

function chaveDe(numero: number, serie = 1) {
  return montarChave({
    uf: "PI",
    dhEmi: "2026-11-03T10:00:00-03:00",
    cnpj: "11222333000181",
    modelo: 65,
    serie,
    numero,
    tpEmis: TP_EMIS.NORMAL,
    cNF: "12345678",
  });
}

const autorizacao = (numero = 7) => ({
  chave: chaveDe(numero),
  protocolo: "122000000000001",
  autorizadoEm: AGORA,
});

describe("DocumentoFiscal", () => {
  it("nasce PENDING com modelo e ambiente vindos da nota", () => {
    const doc = novoDocumento().paraDados();
    expect(doc).toMatchObject({
      status: "PENDING",
      modelo: 65,
      ambiente: "HOMOLOGACAO",
      tentativas: 0,
    });
  });

  it("PENDING → PROCESSING → AUTHORIZED guarda chave e protocolo", () => {
    const doc = novoDocumento();
    doc.marcarProcessando();
    doc.autorizar(autorizacao());
    expect(doc.paraDados()).toMatchObject({
      status: "AUTHORIZED",
      protocolo: "122000000000001",
    });
    expect(doc.finalizado).toBe(true);
  });

  it("recusa chave inválida ou de outra nota", () => {
    const doc = novoDocumento();
    expect(() => doc.autorizar({ ...autorizacao(), chave: "123" })).toThrow(
      ErroFiscal,
    );
    expect(() => doc.autorizar(autorizacao(8))).toThrow(/não corresponde/);
    expect(doc.status).toBe("PENDING");
  });

  it("rejeitada volta para a fila com o mesmo número e a nota corrigida", () => {
    const doc = novoDocumento();
    doc.rejeitar({ codigo: "778", motivo: "Informado NCM inexistente" });
    const corrigida = notaDeExemplo({ informacoesAdicionais: "corrigida" });
    doc.reabrirParaReenvio(corrigida);
    expect(doc.paraDados()).toMatchObject({
      status: "PENDING",
      numero: 7,
      rejeicao: null,
      nota: corrigida,
    });
  });

  it("só cancela nota autorizada, com justificativa de 15 a 255 caracteres", () => {
    const doc = novoDocumento();
    const cancelamento = {
      protocolo: "1",
      justificativa: "Cliente desistiu da compra",
      canceladoEm: AGORA,
    };
    expect(() => doc.cancelar(cancelamento)).toThrow(TransicaoInvalidaError);

    doc.autorizar(autorizacao());
    expect(() =>
      doc.cancelar({ ...cancelamento, justificativa: "curta" }),
    ).toThrow(JustificativaInvalidaError);
    doc.cancelar(cancelamento);
    expect(doc.status).toBe("CANCELLED");
  });

  it("denegada e cancelada não saem do lugar", () => {
    const denegada = novoDocumento();
    denegada.denegar({
      codigo: "301",
      motivo: "Irregularidade fiscal do emitente",
    });
    expect(() => denegada.reabrirParaReenvio(notaDeExemplo())).toThrow(
      TransicaoInvalidaError,
    );
  });

  it("paraDados devolve cópia: alterar o retorno não muda a entidade", () => {
    const doc = novoDocumento();
    const dados = doc.paraDados();
    dados.status = "AUTHORIZED";
    expect(doc.status).toBe("PENDING");
  });
});
