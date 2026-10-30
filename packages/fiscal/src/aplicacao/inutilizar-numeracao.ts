import type { ModeloDocumento } from "../core/chave";
import { DocumentoFiscal } from "../dominio/documento-fiscal";
import {
  FaixaInvalidaError,
  InutilizacaoRecusadaError,
} from "../dominio/erros";
import { somenteDigitos } from "../dominio/identificadores";
import type { Ambiente } from "../dominio/nota-fiscal";
import type {
  ArmazenamentoFiscal,
  GeradorDeId,
  Inutilizacao,
  NumeracaoFiscal,
  ProvedoresFiscais,
  Relogio,
  RepositorioDocumentoFiscal,
  RepositorioInutilizacao,
} from "./portas";

export type InutilizarNumeracaoDeps = {
  documentos: RepositorioDocumentoFiscal;
  inutilizacoes: RepositorioInutilizacao;
  numeracao: NumeracaoFiscal;
  provedores: ProvedoresFiscais;
  armazenamento: ArmazenamentoFiscal;
  relogio: Relogio;
  ids: GeradorDeId;
};

/**
 * Inutiliza na SEFAZ uma faixa de números que a série reservou e não vai usar.
 * Número pulado sem inutilização é pendência fiscal da empresa: a SEFAZ cruza
 * a sequência, e o contador pergunta por cada buraco.
 *
 * Só aceita faixa já reservada (abaixo do próximo número) e sem nota que
 * exista na SEFAZ. Rejeitadas dentro da faixa viram VOIDED — a empresa
 * desistiu delas, e a venda fica livre para emitir outra nota.
 */
export class InutilizarNumeracao {
  private readonly deps: InutilizarNumeracaoDeps;

  constructor(deps: InutilizarNumeracaoDeps) {
    this.deps = deps;
  }

  async executar(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    ambiente: Ambiente;
    cnpj: string;
    serie: number;
    numeroInicial: number;
    numeroFinal: number;
    justificativa: string;
  }): Promise<Inutilizacao> {
    const d = this.deps;
    const { organizationId, modelo, serie, numeroInicial, numeroFinal } = input;
    const justificativa = DocumentoFiscal.validarJustificativa(
      input.justificativa,
    );

    if (
      !Number.isInteger(numeroInicial) ||
      !Number.isInteger(numeroFinal) ||
      numeroInicial < 1 ||
      numeroFinal < numeroInicial
    )
      throw new FaixaInvalidaError(
        "Informe uma faixa válida: o número final não pode ser menor que o inicial.",
      );

    const proximo = await d.numeracao.proximo({
      organizationId,
      modelo,
      serie,
    });
    if (proximo === null || numeroFinal >= proximo)
      throw new FaixaInvalidaError(
        proximo === null
          ? `A série ${serie} ainda não emitiu nenhuma nota.`
          : `Só dá para inutilizar número já reservado — o próximo da série ${serie} é o ${proximo}.`,
      );

    const jaInutilizadas = await d.inutilizacoes.listarDaSerie({
      organizationId,
      modelo,
      serie,
    });
    const sobreposta = jaInutilizadas.find(
      (f) => numeroInicial <= f.numeroFinal && numeroFinal >= f.numeroInicial,
    );
    if (sobreposta)
      throw new FaixaInvalidaError(
        `A faixa ${sobreposta.numeroInicial}–${sobreposta.numeroFinal} já foi inutilizada.`,
      );

    const naFaixa = await d.documentos.listarDaFaixa({
      organizationId,
      modelo,
      serie,
      numeroInicial,
      numeroFinal,
    });
    const emUso = naFaixa.find(
      (doc) => doc.status !== "REJECTED" && doc.status !== "VOIDED",
    );
    if (emUso)
      throw new FaixaInvalidaError(
        `O número ${emUso.numero} tem nota ${rotulo(emUso.status)} — tire-o da faixa.`,
      );

    const provedor = await d.provedores.daOrganizacao(organizationId);
    const resposta = await provedor.inutilizar({
      modelo,
      cnpj: somenteDigitos(input.cnpj),
      serie,
      numeroInicial,
      numeroFinal,
      justificativa,
    });
    if (resposta.situacao === "RECUSADA")
      throw new InutilizacaoRecusadaError(resposta.codigo, resposta.motivo);

    const id = d.ids.gerar();
    let xmlKey: string | null = null;
    if (resposta.xml) {
      // Já vale na SEFAZ: sem o XML o registro ainda precisa existir.
      try {
        xmlKey = await d.armazenamento.guardar({
          organizationId,
          documentoId: id,
          tipo: "xml-inutilizacao",
          arquivo: resposta.xml,
        });
      } catch (erro) {
        console.error("[fiscal] XML da inutilização não foi guardado:", erro);
      }
    }

    const inutilizacao: Inutilizacao = {
      id,
      organizationId,
      modelo,
      ambiente: input.ambiente,
      serie,
      numeroInicial,
      numeroFinal,
      justificativa,
      protocolo: resposta.protocolo,
      inutilizadaEm: resposta.inutilizadaEm ?? d.relogio.agora(),
      xmlKey,
    };
    await d.inutilizacoes.salvar(inutilizacao);

    for (const doc of naFaixa)
      if (doc.status === "REJECTED") {
        doc.inutilizar(id);
        await d.documentos.salvar(doc);
      }

    return inutilizacao;
  }
}

function rotulo(status: string): string {
  const rotulos: Record<string, string> = {
    PENDING: "aguardando envio",
    PROCESSING: "em processamento",
    AUTHORIZED: "autorizada",
    CANCELLED: "cancelada",
    DENIED: "denegada",
    CONTINGENCY: "em contingência",
  };
  return rotulos[status] ?? status.toLowerCase();
}
