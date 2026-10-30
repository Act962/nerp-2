import { beforeEach, describe, expect, it } from "vitest";
import {
  CadastroFiscalIncompletoError,
  CancelamentoForaDoPrazoError,
  CancelamentoRecusadoError,
  FaixaInvalidaError,
  InutilizacaoRecusadaError,
  ProvedorIndisponivelError,
  TransicaoInvalidaError,
  VendaNaoEncontradaError,
} from "../dominio/erros";
import {
  ArmazenamentoFiscalEmMemoria,
  IdsSequenciais,
  MontadorDeNotaEmMemoria,
  NumeracaoFiscalEmMemoria,
  ProvedoresFiscaisEmMemoria,
  RelogioFixo,
  RepositorioDocumentoFiscalEmMemoria,
  RepositorioInutilizacaoEmMemoria,
} from "../testes/em-memoria";
import { notaDeExemplo } from "../testes/nota-de-exemplo";
import {
  NCM_INEXISTENTE,
  ProvedorFiscalSimulado,
} from "../testes/provedor-simulado";
import { CancelarDocumentoFiscal } from "./cancelar-documento-fiscal";
import { InutilizarNumeracao } from "./inutilizar-numeracao";
import { ProcessarEmissao } from "./processar-emissao";
import { ReenviarDocumentoRejeitado } from "./reenviar-documento-rejeitado";
import { SolicitarEmissaoNfce } from "./solicitar-emissao-nfce";

const ORG = "org-1";
const VENDA = "venda-1";

function cenario() {
  const documentos = new RepositorioDocumentoFiscalEmMemoria();
  const montador = new MontadorDeNotaEmMemoria();
  const numeracao = new NumeracaoFiscalEmMemoria();
  const armazenamento = new ArmazenamentoFiscalEmMemoria();
  const provedor = new ProvedorFiscalSimulado();
  const provedores = new ProvedoresFiscaisEmMemoria(provedor);
  const relogio = new RelogioFixo();
  const ids = new IdsSequenciais();
  const inutilizacoes = new RepositorioInutilizacaoEmMemoria();

  montador.definir(ORG, VENDA, { nota: notaDeExemplo(), serie: 1 });

  return {
    documentos,
    montador,
    numeracao,
    armazenamento,
    provedor,
    relogio,
    solicitar: new SolicitarEmissaoNfce({
      documentos,
      montador,
      numeracao,
      relogio,
      ids,
    }),
    processar: new ProcessarEmissao({
      documentos,
      provedores,
      armazenamento,
      relogio,
    }),
    reenviar: new ReenviarDocumentoRejeitado({ documentos, montador }),
    cancelar: new CancelarDocumentoFiscal({
      documentos,
      provedores,
      armazenamento,
      relogio,
    }),
    inutilizacoes,
    inutilizar: new InutilizarNumeracao({
      documentos,
      inutilizacoes,
      numeracao,
      provedores,
      armazenamento,
      relogio,
      ids: new IdsSequenciais(),
    }),
  };
}

let c: ReturnType<typeof cenario>;
beforeEach(() => {
  c = cenario();
});

async function emitirAteAutorizar() {
  const { documentoId } = await c.solicitar.executar({
    organizationId: ORG,
    saleId: VENDA,
  });
  await c.processar.executar({ organizationId: ORG, documentoId });
  return documentoId;
}

describe("SolicitarEmissaoNfce", () => {
  it("valida, reserva o próximo número e grava PENDING", async () => {
    const r = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    expect(r).toEqual({
      documentoId: "doc-1",
      status: "PENDING",
      jaExistia: false,
    });
    expect(c.documentos.registros.get("doc-1")).toMatchObject({
      serie: 1,
      numero: 1,
      saleId: VENDA,
    });
  });

  it("é idempotente: segunda chamada para a mesma venda não reserva outro número", async () => {
    await c.solicitar.executar({ organizationId: ORG, saleId: VENDA });
    const r = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    expect(r.jaExistia).toBe(true);
    expect(c.numeracao.ultimo(ORG, 65, 1)).toBe(1);
  });

  it("cadastro incompleto não queima número", async () => {
    const nota = notaDeExemplo();
    nota.itens[0] = { ...nota.itens[0], ncm: "" };
    c.montador.definir(ORG, VENDA, { nota, serie: 1 });

    const erro = await c.solicitar
      .executar({ organizationId: ORG, saleId: VENDA })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(CadastroFiscalIncompletoError);
    expect(erro.pendencias[0].campo).toBe("itens[0].ncm");
    expect(c.numeracao.ultimo(ORG, 65, 1)).toBe(0);
  });

  it("venda de outra organização é 'não encontrada'", async () => {
    await expect(
      c.solicitar.executar({ organizationId: "org-2", saleId: VENDA }),
    ).rejects.toBeInstanceOf(VendaNaoEncontradaError);
  });
});

describe("ProcessarEmissao", () => {
  it("autoriza, guarda XML e DANFCe no bucket e grava chave/protocolo", async () => {
    const documentoId = await emitirAteAutorizar();
    const dados = c.documentos.registros.get(documentoId);
    expect(dados).toMatchObject({
      status: "AUTHORIZED",
      xmlKey: `fiscal/${ORG}/documentos/${documentoId}-xml.xml`,
      danfeKey: `fiscal/${ORG}/documentos/${documentoId}-danfe.pdf`,
      tentativas: 1,
    });
    expect(dados?.chave).toHaveLength(44);
  });

  it("SEFAZ assíncrona: primeiro PROCESSING, depois só CONSULTA — nunca reenvia", async () => {
    c.provedor.modo = "ASSINCRONO";
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });

    const primeira = await c.processar.executar({
      organizationId: ORG,
      documentoId,
    });
    expect(primeira).toEqual({
      status: "PROCESSING",
      consultarNovamente: true,
    });

    const segunda = await c.processar.executar({
      organizationId: ORG,
      documentoId,
    });
    expect(segunda).toEqual({
      status: "AUTHORIZED",
      consultarNovamente: false,
    });
    expect(c.provedor.chamadasEmitir).toBe(1);
  });

  it("rejeição é desfecho gravado, não exceção", async () => {
    const nota = notaDeExemplo();
    nota.itens[0] = { ...nota.itens[0], ncm: NCM_INEXISTENTE };
    c.montador.definir(ORG, VENDA, { nota, serie: 1 });
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });

    const r = await c.processar.executar({ organizationId: ORG, documentoId });
    expect(r.status).toBe("REJECTED");
    expect(c.documentos.registros.get(documentoId)?.rejeicao).toEqual({
      codigo: "778",
      motivo: "Informado NCM inexistente",
    });
  });

  it("provedor fora do ar: conta a tentativa e deixa o erro subir para o retry", async () => {
    c.provedor.indisponivel = true;
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });

    await expect(
      c.processar.executar({ organizationId: ORG, documentoId }),
    ).rejects.toBeInstanceOf(ProvedorIndisponivelError);
    expect(c.documentos.registros.get(documentoId)).toMatchObject({
      status: "PENDING",
      tentativas: 1,
    });

    c.provedor.indisponivel = false;
    const r = await c.processar.executar({ organizationId: ORG, documentoId });
    expect(r.status).toBe("AUTHORIZED");
  });

  it("bucket falhou depois da autorização: o retry recupera sem emitir de novo", async () => {
    c.armazenamento.falhar = true;
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    await expect(
      c.processar.executar({ organizationId: ORG, documentoId }),
    ).rejects.toThrow(/Bucket/);

    c.armazenamento.falhar = false;
    const r = await c.processar.executar({ organizationId: ORG, documentoId });
    expect(r.status).toBe("AUTHORIZED");
    // O provedor recebeu a mesma ref duas vezes e devolveu a mesma nota.
    expect(c.provedor.chamadasEmitir).toBe(2);
    expect(c.documentos.registros.size).toBe(1);
  });

  it("documento já autorizado: não chama o provedor de novo", async () => {
    const documentoId = await emitirAteAutorizar();
    await c.processar.executar({ organizationId: ORG, documentoId });
    expect(c.provedor.chamadasEmitir).toBe(1);
  });

  it("manda a hora do ENVIO como dhEmi, não a da criação", async () => {
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    c.relogio.avancar(60 * 60 * 1000);
    await c.processar.executar({ organizationId: ORG, documentoId });
    expect(c.documentos.registros.get(documentoId)?.autorizadoEm).toEqual(
      c.relogio.agora(),
    );
  });
});

describe("ReenviarDocumentoRejeitado", () => {
  it("depois de corrigir o cadastro, reemite com o mesmo número", async () => {
    const errada = notaDeExemplo();
    errada.itens[0] = { ...errada.itens[0], ncm: NCM_INEXISTENTE };
    c.montador.definir(ORG, VENDA, { nota: errada, serie: 1 });
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    await c.processar.executar({ organizationId: ORG, documentoId });

    c.montador.definir(ORG, VENDA, { nota: notaDeExemplo(), serie: 1 });
    await c.reenviar.executar({ organizationId: ORG, documentoId });
    const r = await c.processar.executar({ organizationId: ORG, documentoId });

    expect(r.status).toBe("AUTHORIZED");
    expect(c.documentos.registros.get(documentoId)?.numero).toBe(1);
    expect(c.numeracao.ultimo(ORG, 65, 1)).toBe(1);
  });

  it("não reabre nota autorizada", async () => {
    const documentoId = await emitirAteAutorizar();
    await expect(
      c.reenviar.executar({ organizationId: ORG, documentoId }),
    ).rejects.toBeInstanceOf(TransicaoInvalidaError);
  });
});

describe("CancelarDocumentoFiscal", () => {
  const justificativa = "Cliente desistiu da compra no caixa";

  it("cancela nota autorizada", async () => {
    const documentoId = await emitirAteAutorizar();
    await c.cancelar.executar({
      organizationId: ORG,
      documentoId,
      justificativa,
    });
    expect(c.documentos.registros.get(documentoId)).toMatchObject({
      status: "CANCELLED",
      xmlCancelamentoKey: `fiscal/${ORG}/documentos/${documentoId}-xml-cancelamento.xml`,
    });
  });

  it("depois de 30 minutos recusa sem chamar o provedor", async () => {
    const documentoId = await emitirAteAutorizar();
    c.relogio.avancar(31 * 60 * 1000);
    await expect(
      c.cancelar.executar({ organizationId: ORG, documentoId, justificativa }),
    ).rejects.toBeInstanceOf(CancelamentoForaDoPrazoError);
    expect(c.documentos.registros.get(documentoId)?.status).toBe("AUTHORIZED");
  });

  it("XML do evento que não foi guardado não impede o cancelamento", async () => {
    const documentoId = await emitirAteAutorizar();
    c.armazenamento.falhar = true;
    await c.cancelar.executar({
      organizationId: ORG,
      documentoId,
      justificativa,
    });
    expect(c.documentos.registros.get(documentoId)).toMatchObject({
      status: "CANCELLED",
      xmlCancelamentoKey: null,
    });
  });

  it("recusa da SEFAZ (ex.: fora do prazo) vira erro com o motivo e não muda o status", async () => {
    const documentoId = await emitirAteAutorizar();
    c.provedor.recusarCancelamento = true;
    const erro = await c.cancelar
      .executar({ organizationId: ORG, documentoId, justificativa })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(CancelamentoRecusadoError);
    expect(erro.codigoSefaz).toBe("501");
    expect(c.documentos.registros.get(documentoId)?.status).toBe("AUTHORIZED");
  });

  it("nota pendente não vai ao provedor", async () => {
    const { documentoId } = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    await expect(
      c.cancelar.executar({ organizationId: ORG, documentoId, justificativa }),
    ).rejects.toBeInstanceOf(TransicaoInvalidaError);
  });
});

describe("InutilizarNumeracao", () => {
  const justificativa = "Venda desistida depois da rejeição do cadastro";
  const base = {
    organizationId: ORG,
    modelo: 65 as const,
    ambiente: "HOMOLOGACAO" as const,
    cnpj: "11.222.333/0001-81",
    serie: 1,
    justificativa,
  };

  /** Nº 1 rejeitado (venda-1) e nº 2 autorizado (venda-2). */
  async function rejeitadaEAutorizada() {
    const errada = notaDeExemplo();
    errada.itens[0] = { ...errada.itens[0], ncm: NCM_INEXISTENTE };
    c.montador.definir(ORG, VENDA, { nota: errada, serie: 1 });
    const rejeitada = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    await c.processar.executar({
      organizationId: ORG,
      documentoId: rejeitada.documentoId,
    });
    c.montador.definir(ORG, "venda-2", { nota: notaDeExemplo(), serie: 1 });
    const autorizada = await c.solicitar.executar({
      organizationId: ORG,
      saleId: "venda-2",
    });
    await c.processar.executar({
      organizationId: ORG,
      documentoId: autorizada.documentoId,
    });
    return { rejeitada: rejeitada.documentoId };
  }

  it("inutiliza o número da rejeitada e libera a venda para outra nota", async () => {
    const { rejeitada } = await rejeitadaEAutorizada();

    const r = await c.inutilizar.executar({
      ...base,
      numeroInicial: 1,
      numeroFinal: 1,
    });

    expect(r).toMatchObject({ numeroInicial: 1, numeroFinal: 1 });
    expect(r.protocolo).toMatch(/^\d{15}$/);
    expect(r.xmlKey).toContain("xml-inutilizacao");
    expect(c.inutilizacoes.registros).toHaveLength(1);
    expect(c.documentos.registros.get(rejeitada)).toMatchObject({
      status: "VOIDED",
      inutilizacaoId: r.id,
    });

    c.montador.definir(ORG, VENDA, { nota: notaDeExemplo(), serie: 1 });
    const nova = await c.solicitar.executar({
      organizationId: ORG,
      saleId: VENDA,
    });
    expect(nova.documentoId).not.toBe(rejeitada);
    expect(c.documentos.registros.get(nova.documentoId)?.numero).toBe(3);
  });

  it("recusa faixa com nota autorizada, sem chamar o provedor", async () => {
    await rejeitadaEAutorizada();
    await expect(
      c.inutilizar.executar({ ...base, numeroInicial: 1, numeroFinal: 2 }),
    ).rejects.toThrow(/número 2 tem nota autorizada/);
    expect(c.inutilizacoes.registros).toHaveLength(0);
  });

  it("recusa número ainda não reservado pela série", async () => {
    await rejeitadaEAutorizada();
    await expect(
      c.inutilizar.executar({ ...base, numeroInicial: 3, numeroFinal: 5 }),
    ).rejects.toBeInstanceOf(FaixaInvalidaError);
  });

  it("recusa faixa invertida e faixa já inutilizada", async () => {
    await rejeitadaEAutorizada();
    await expect(
      c.inutilizar.executar({ ...base, numeroInicial: 2, numeroFinal: 1 }),
    ).rejects.toBeInstanceOf(FaixaInvalidaError);
    await c.inutilizar.executar({ ...base, numeroInicial: 1, numeroFinal: 1 });
    await expect(
      c.inutilizar.executar({ ...base, numeroInicial: 1, numeroFinal: 1 }),
    ).rejects.toThrow(/já foi inutilizada/);
  });

  it("recusa da SEFAZ vira InutilizacaoRecusadaError e nada é gravado", async () => {
    const { rejeitada } = await rejeitadaEAutorizada();
    // Inutilizada por fora do NERP: o banco não sabe, a SEFAZ sabe.
    await c.provedor.inutilizar({
      modelo: 65,
      cnpj: "11222333000181",
      serie: 1,
      numeroInicial: 1,
      numeroFinal: 1,
      justificativa,
    });
    const erro = await c.inutilizar
      .executar({ ...base, numeroInicial: 1, numeroFinal: 1 })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(InutilizacaoRecusadaError);
    expect(erro.codigoSefaz).toBe("256");
    expect(c.documentos.registros.get(rejeitada)?.status).toBe("REJECTED");
  });

  it("justificativa curta é recusada antes de tudo", async () => {
    await rejeitadaEAutorizada();
    await expect(
      c.inutilizar.executar({
        ...base,
        justificativa: "pulou",
        numeroInicial: 1,
        numeroFinal: 1,
      }),
    ).rejects.toThrow(/15/);
  });
});
