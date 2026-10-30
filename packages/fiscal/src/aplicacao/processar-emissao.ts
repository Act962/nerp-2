import type {
  DocumentoFiscal,
  StatusDocumentoFiscal,
} from "../dominio/documento-fiscal";
import { DocumentoNaoEncontradoError } from "../dominio/erros";
import type {
  ArmazenamentoFiscal,
  ArquivoFiscal,
  ProvedoresFiscais,
  Relogio,
  RepositorioDocumentoFiscal,
  RespostaEmissao,
} from "./portas";

export type ProcessarEmissaoDeps = {
  documentos: RepositorioDocumentoFiscal;
  provedores: ProvedoresFiscais;
  armazenamento: ArmazenamentoFiscal;
  relogio: Relogio;
};

export type ProcessarEmissaoResultado = {
  status: StatusDocumentoFiscal;
  /** A SEFAZ ainda não respondeu: o job agenda outra rodada. */
  consultarNovamente: boolean;
};

/**
 * Leva o documento à SEFAZ (pelo provedor) e registra o desfecho.
 *
 * É o corpo do job em background e pode rodar quantas vezes for preciso:
 *
 * - `PENDING`    → envia;
 * - `PROCESSING` → só consulta (reenviar poderia emitir duas vezes);
 * - finalizado   → não faz nada.
 *
 * `ProvedorIndisponivelError` sobe de propósito, depois de contar a tentativa,
 * para o Inngest refazer o passo. Rejeição não sobe: é um desfecho, gravado.
 */
export class ProcessarEmissao {
  private readonly deps: ProcessarEmissaoDeps;

  constructor(deps: ProcessarEmissaoDeps) {
    this.deps = deps;
  }

  async executar(input: {
    organizationId: string;
    documentoId: string;
  }): Promise<ProcessarEmissaoResultado> {
    const { documentos, provedores, relogio } = this.deps;

    const documento = await documentos.buscarPorId(
      input.organizationId,
      input.documentoId,
    );
    if (!documento) throw new DocumentoNaoEncontradoError();
    if (documento.finalizado) return this.resultado(documento);

    const provedor = await provedores.daOrganizacao(input.organizationId);
    const agora = relogio.agora();
    documento.registrarTentativa(agora);

    let resposta: RespostaEmissao;
    try {
      resposta =
        documento.status === "PROCESSING"
          ? await provedor.consultar(documento.id, documento.modelo)
          : await provedor.emitir({
              ref: documento.id,
              serie: documento.serie,
              numero: documento.numero,
              emitidaEm: agora,
              nota: documento.nota,
            });
    } catch (erro) {
      await documentos.salvar(documento);
      throw erro;
    }

    await this.aplicar(documento, resposta);
    await documentos.salvar(documento);
    return this.resultado(documento);
  }

  private async aplicar(
    documento: DocumentoFiscal,
    resposta: RespostaEmissao,
  ): Promise<void> {
    switch (resposta.situacao) {
      case "PROCESSANDO":
        documento.marcarProcessando();
        return;
      case "REJEITADA":
        documento.rejeitar({
          codigo: resposta.codigo,
          motivo: resposta.motivo,
        });
        return;
      case "DENEGADA":
        documento.denegar({ codigo: resposta.codigo, motivo: resposta.motivo });
        return;
      case "AUTORIZADA": {
        // Arquivos antes da autorização: se o bucket falhar, o job refaz e o
        // provedor devolve a mesma autorização (contrato da `ref`).
        const [xmlKey, danfeKey] = await Promise.all([
          resposta.xml ? this.guardar(documento, "xml", resposta.xml) : null,
          resposta.danfe
            ? this.guardar(documento, "danfe", resposta.danfe)
            : null,
        ]);
        documento.autorizar({
          chave: resposta.chave,
          protocolo: resposta.protocolo,
          autorizadoEm: resposta.autorizadaEm,
          qrCodeUrl: resposta.qrCodeUrl,
          consultaUrl: resposta.consultaUrl,
        });
        documento.anexarArquivos({ xmlKey, danfeKey });
        return;
      }
    }
  }

  private guardar(
    documento: DocumentoFiscal,
    tipo: "xml" | "danfe",
    arquivo: ArquivoFiscal,
  ): Promise<string> {
    return this.deps.armazenamento.guardar({
      organizationId: documento.organizationId,
      documentoId: documento.id,
      tipo,
      arquivo,
    });
  }

  private resultado(documento: DocumentoFiscal): ProcessarEmissaoResultado {
    return {
      status: documento.status,
      consultarNovamente: documento.status === "PROCESSING",
    };
  }
}
