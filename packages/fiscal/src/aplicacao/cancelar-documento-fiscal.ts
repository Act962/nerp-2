import { DocumentoFiscal } from "../dominio/documento-fiscal";
import {
  CancelamentoForaDoPrazoError,
  CancelamentoRecusadoError,
  DocumentoNaoEncontradoError,
} from "../dominio/erros";
import type {
  ArmazenamentoFiscal,
  ProvedoresFiscais,
  Relogio,
  RepositorioDocumentoFiscal,
} from "./portas";

export type CancelarDocumentoFiscalDeps = {
  documentos: RepositorioDocumentoFiscal;
  provedores: ProvedoresFiscais;
  armazenamento: ArmazenamentoFiscal;
  relogio: Relogio;
};

/**
 * Cancela uma nota autorizada. Status, justificativa e prazo são conferidos
 * ANTES de chamar o provedor, para o caixa ler "o prazo terminou às 10:42" em
 * vez de um código da SEFAZ. A SEFAZ continua sendo a palavra final: a recusa
 * dela vira `CancelamentoRecusadoError` com o motivo para a tela.
 */
export class CancelarDocumentoFiscal {
  private readonly deps: CancelarDocumentoFiscalDeps;

  constructor(deps: CancelarDocumentoFiscalDeps) {
    this.deps = deps;
  }

  async executar(input: {
    organizationId: string;
    documentoId: string;
    justificativa: string;
  }): Promise<void> {
    const { documentos, provedores, armazenamento, relogio } = this.deps;

    const documento = await documentos.buscarPorId(
      input.organizationId,
      input.documentoId,
    );
    if (!documento) throw new DocumentoNaoEncontradoError();
    documento.exigirPermite("CANCELLED", "cancelamento");
    const justificativa = DocumentoFiscal.validarJustificativa(
      input.justificativa,
    );
    const prazo = documento.cancelavelAte;
    if (prazo && relogio.agora() > prazo)
      throw new CancelamentoForaDoPrazoError(prazo);

    const provedor = await provedores.daOrganizacao(input.organizationId);
    const resposta = await provedor.cancelar({
      ref: documento.id,
      modelo: documento.modelo,
      // Autorizado sempre tem chave — garantido por `autorizar`.
      chave: documento.chave ?? "",
      justificativa,
    });

    if (resposta.situacao === "RECUSADA")
      throw new CancelamentoRecusadoError(resposta.codigo, resposta.motivo);

    // O cancelamento já vale na SEFAZ: falha ao guardar o XML do evento não
    // pode deixar a nota "autorizada" aqui.
    if (resposta.xml) {
      try {
        const xmlCancelamentoKey = await armazenamento.guardar({
          organizationId: documento.organizationId,
          documentoId: documento.id,
          tipo: "xml-cancelamento",
          arquivo: resposta.xml,
        });
        documento.anexarArquivos({ xmlCancelamentoKey });
      } catch (erro) {
        console.error("[fiscal] XML do cancelamento não foi guardado:", erro);
      }
    }
    documento.cancelar({
      protocolo: resposta.protocolo,
      justificativa,
      canceladoEm: resposta.canceladaEm,
    });
    await documentos.salvar(documento);
  }
}
