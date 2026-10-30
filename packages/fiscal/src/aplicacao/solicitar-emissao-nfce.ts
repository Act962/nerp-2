import { TP_EMIS } from "../core/chave";
import {
  DocumentoFiscal,
  type StatusDocumentoFiscal,
} from "../dominio/documento-fiscal";
import {
  CadastroFiscalIncompletoError,
  VendaNaoEncontradaError,
} from "../dominio/erros";
import type { Destinatario } from "../dominio/nota-fiscal";
import { validarNotaParaEmissao } from "../dominio/validacao";
import type {
  GeradorDeId,
  MontadorDeNota,
  NumeracaoFiscal,
  Relogio,
  RepositorioDocumentoFiscal,
} from "./portas";

export type SolicitarEmissaoNfceDeps = {
  documentos: RepositorioDocumentoFiscal;
  montador: MontadorDeNota;
  numeracao: NumeracaoFiscal;
  relogio: Relogio;
  ids: GeradorDeId;
};

export type SolicitarEmissaoNfceResultado = {
  documentoId: string;
  status: StatusDocumentoFiscal;
  /** `true` quando a venda já tinha nota — a chamada foi um no-op. */
  jaExistia: boolean;
};

/**
 * Venda concluída → nota na fila.
 *
 * Roda dentro da requisição do PDV e é rápido de propósito: não fala com o
 * provedor. Valida, reserva o número e grava o documento `PENDING`; quem
 * transmite é `ProcessarEmissao`, em background. A venda nunca espera a SEFAZ.
 *
 * Idempotente: chamar de novo para a mesma venda devolve o documento que já
 * existe (duplo clique, replay do caixa offline).
 */
export class SolicitarEmissaoNfce {
  private readonly deps: SolicitarEmissaoNfceDeps;

  constructor(deps: SolicitarEmissaoNfceDeps) {
    this.deps = deps;
  }

  async executar(input: {
    organizationId: string;
    saleId: string;
    /** "CPF na nota" — ver `MontadorDeNota.montar`. */
    destinatario?: Destinatario | null;
  }): Promise<SolicitarEmissaoNfceResultado> {
    const { documentos, montador, numeracao, relogio, ids } = this.deps;

    const existente = await documentos.buscarVigenteDaVenda(
      input.organizationId,
      input.saleId,
      65,
    );
    if (existente)
      return {
        documentoId: existente.id,
        status: existente.status,
        jaExistia: true,
      };

    const venda = await montador.montar({ ...input, modelo: 65 });
    if (!venda) throw new VendaNaoEncontradaError();

    // Valida ANTES de reservar: número reservado e não usado vira buraco na
    // sequência, e buraco obriga a inutilizar o número na SEFAZ.
    const pendencias = validarNotaParaEmissao(venda.nota);
    if (pendencias.length > 0)
      throw new CadastroFiscalIncompletoError(pendencias);

    const numero = await numeracao.reservar({
      organizationId: input.organizationId,
      modelo: 65,
      serie: venda.serie,
    });

    const documento = DocumentoFiscal.criar({
      id: ids.gerar(),
      organizationId: input.organizationId,
      saleId: input.saleId,
      serie: venda.serie,
      numero,
      tpEmis: TP_EMIS.NORMAL,
      nota: venda.nota,
      criadoEm: relogio.agora(),
    });
    await documentos.salvar(documento);

    return {
      documentoId: documento.id,
      status: documento.status,
      jaExistia: false,
    };
  }
}
