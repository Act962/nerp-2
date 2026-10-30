import {
  type ModeloDocumento,
  type TpEmis,
  chaveValida,
  partesDaChave,
} from "../core/chave";
import {
  ErroFiscal,
  JustificativaInvalidaError,
  TransicaoInvalidaError,
} from "./erros";
import type { Ambiente, NotaFiscal } from "./nota-fiscal";

/**
 * Ciclo de vida de UMA nota emitida (ou tentada) para uma venda.
 *
 * Os valores espelham o enum `FiscalDocumentStatus` do banco de propósito: o
 * repositório grava e lê sem tabela de tradução.
 *
 *   PENDING ──► PROCESSING ──► AUTHORIZED ──► CANCELLED
 *      │             │
 *      ├─────────────┴──► REJECTED ──(corrige cadastro)──► PENDING
 *      └─────────────────► DENIED   (irreversível)
 *
 *   REJECTED ──(desistiu da nota)──► VOIDED  (número inutilizado na SEFAZ)
 *
 * CONTINGENCY é a nota emitida offline no caixa, que ainda vai à SEFAZ.
 */
export type StatusDocumentoFiscal =
  | "PENDING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "REJECTED"
  | "CANCELLED"
  | "DENIED"
  | "VOIDED"
  | "CONTINGENCY";

const TRANSICOES: Record<StatusDocumentoFiscal, StatusDocumentoFiscal[]> = {
  PENDING: ["PROCESSING", "AUTHORIZED", "REJECTED", "DENIED"],
  PROCESSING: ["PROCESSING", "AUTHORIZED", "REJECTED", "DENIED"],
  CONTINGENCY: ["PROCESSING", "AUTHORIZED", "REJECTED", "DENIED"],
  REJECTED: ["PENDING", "VOIDED"],
  AUTHORIZED: ["CANCELLED"],
  CANCELLED: [],
  DENIED: [],
  VOIDED: [],
};

/**
 * Documentos que deixaram de ser "a nota da venda": a venda pode emitir outra.
 * O índice parcial `fiscal_documents_vigente_por_venda` usa a mesma lista.
 */
export const STATUS_FORA_DE_VIGOR: readonly StatusDocumentoFiscal[] = [
  "CANCELLED",
  "VOIDED",
];

/**
 * Prazo para cancelar depois da autorização. Na NFC-e é a regra da SVRS (que
 * autoriza o Piauí) e também o limite da Focus: 30 minutos. Na NF-e, 24 horas.
 * Passou disso, o caminho legal é outro (devolução), não o cancelamento.
 */
export const PRAZO_CANCELAMENTO_MS: Record<ModeloDocumento, number> = {
  65: 30 * 60 * 1000,
  55: 24 * 60 * 60 * 1000,
};

export type DocumentoFiscalDados = {
  id: string;
  organizationId: string;
  saleId: string;
  modelo: ModeloDocumento;
  ambiente: Ambiente;
  serie: number;
  numero: number;
  tpEmis: TpEmis;
  status: StatusDocumentoFiscal;
  /**
   * O que foi (ou será) enviado. Guardado no documento, e não remontado da
   * venda a cada tentativa: reenvio e auditoria precisam do MESMO conteúdo,
   * mesmo que o cadastro do produto mude depois.
   */
  nota: NotaFiscal;
  chave: string | null;
  protocolo: string | null;
  autorizadoEm: Date | null;
  rejeicao: { codigo: string; motivo: string } | null;
  cancelamento: {
    protocolo: string;
    justificativa: string;
    canceladoEm: Date;
  } | null;
  /** Inutilização do número de uma nota rejeitada que não vai mais sair. */
  inutilizacaoId: string | null;
  /** QR Code e URL de consulta impressos no DANFCe. */
  qrCodeUrl: string | null;
  consultaUrl: string | null;
  xmlKey: string | null;
  danfeKey: string | null;
  /** XML do evento de cancelamento — o contador precisa dele junto com o da nota. */
  xmlCancelamentoKey: string | null;
  tentativas: number;
  ultimaTentativaEm: Date | null;
  criadoEm: Date;
};

export type CriarDocumentoFiscal = Pick<
  DocumentoFiscalDados,
  "id" | "organizationId" | "saleId" | "serie" | "numero" | "tpEmis" | "nota"
> & { criadoEm: Date };

export class DocumentoFiscal {
  private dados: DocumentoFiscalDados;

  private constructor(dados: DocumentoFiscalDados) {
    this.dados = dados;
  }

  static criar(input: CriarDocumentoFiscal): DocumentoFiscal {
    return new DocumentoFiscal({
      ...input,
      modelo: input.nota.modelo,
      ambiente: input.nota.ambiente,
      status: "PENDING",
      chave: null,
      protocolo: null,
      autorizadoEm: null,
      rejeicao: null,
      cancelamento: null,
      inutilizacaoId: null,
      xmlKey: null,
      danfeKey: null,
      xmlCancelamentoKey: null,
      qrCodeUrl: null,
      consultaUrl: null,
      tentativas: 0,
      ultimaTentativaEm: null,
    });
  }

  /** Reconstrói a partir do que o repositório leu do banco. */
  static restaurar(dados: DocumentoFiscalDados): DocumentoFiscal {
    return new DocumentoFiscal({ ...dados });
  }

  /** Regra da SEFAZ para cancelamento e carta de correção: 15 a 255 caracteres. */
  static validarJustificativa(justificativa: string): string {
    const texto = justificativa.trim();
    if (texto.length < 15 || texto.length > 255)
      throw new JustificativaInvalidaError();
    return texto;
  }

  get id() {
    return this.dados.id;
  }
  get organizationId() {
    return this.dados.organizationId;
  }
  get saleId() {
    return this.dados.saleId;
  }
  get status() {
    return this.dados.status;
  }
  get modelo() {
    return this.dados.modelo;
  }
  get serie() {
    return this.dados.serie;
  }
  get numero() {
    return this.dados.numero;
  }
  get nota() {
    return this.dados.nota;
  }
  get chave() {
    return this.dados.chave;
  }
  get autorizadoEm() {
    return this.dados.autorizadoEm;
  }

  /** Estados em que não há mais nada a fazer sem uma ação humana. */
  get finalizado(): boolean {
    return ["AUTHORIZED", "REJECTED", "CANCELLED", "DENIED", "VOIDED"].includes(
      this.dados.status,
    );
  }

  /** Até quando a nota autorizada pode ser cancelada; `null` se não pode. */
  get cancelavelAte(): Date | null {
    if (this.dados.status !== "AUTHORIZED" || !this.dados.autorizadoEm)
      return null;
    return new Date(
      this.dados.autorizadoEm.getTime() +
        PRAZO_CANCELAMENTO_MS[this.dados.modelo],
    );
  }

  /** Cópia para persistir — quem grava não altera a entidade por referência. */
  paraDados(): DocumentoFiscalDados {
    return { ...this.dados };
  }

  registrarTentativa(em: Date): void {
    this.dados.tentativas += 1;
    this.dados.ultimaTentativaEm = em;
  }

  marcarProcessando(): void {
    this.transitar("PROCESSING", "aguardar processamento");
  }

  autorizar(input: {
    chave: string;
    protocolo: string;
    autorizadoEm: Date;
    qrCodeUrl?: string | null;
    consultaUrl?: string | null;
  }): void {
    if (!chaveValida(input.chave))
      throw new ErroFiscal(
        "CHAVE_INVALIDA",
        `Chave de acesso inválida: ${input.chave}`,
      );
    // Defesa contra o provedor devolver a chave de OUTRA nota.
    const partes = partesDaChave(input.chave);
    if (
      partes.modelo !== this.dados.modelo ||
      partes.serie !== this.dados.serie ||
      partes.numero !== this.dados.numero
    )
      throw new ErroFiscal(
        "CHAVE_DIVERGENTE",
        "A chave autorizada não corresponde a esta nota",
      );

    this.transitar("AUTHORIZED", "autorização");
    this.dados.chave = input.chave;
    this.dados.protocolo = input.protocolo;
    this.dados.autorizadoEm = input.autorizadoEm;
    this.dados.qrCodeUrl = input.qrCodeUrl ?? null;
    this.dados.consultaUrl = input.consultaUrl ?? null;
    this.dados.rejeicao = null;
  }

  rejeitar(input: { codigo: string; motivo: string }): void {
    this.transitar("REJECTED", "rejeição");
    this.dados.rejeicao = input;
  }

  denegar(input: { codigo: string; motivo: string }): void {
    this.transitar("DENIED", "denegação");
    this.dados.rejeicao = input;
  }

  /**
   * Depois de corrigir o cadastro, a nota rejeitada volta para a fila com o
   * MESMO número — rejeição não consome numeração na SEFAZ — e o conteúdo novo.
   */
  reabrirParaReenvio(notaCorrigida: NotaFiscal): void {
    if (notaCorrigida.modelo !== this.dados.modelo)
      throw new ErroFiscal(
        "MODELO_DIVERGENTE",
        "O reenvio não pode trocar o modelo da nota",
      );
    this.transitar("PENDING", "reenvio");
    this.dados.nota = notaCorrigida;
    this.dados.ambiente = notaCorrigida.ambiente;
    this.dados.rejeicao = null;
  }

  cancelar(input: {
    protocolo: string;
    justificativa: string;
    canceladoEm: Date;
  }): void {
    const justificativa = DocumentoFiscal.validarJustificativa(
      input.justificativa,
    );
    this.transitar("CANCELLED", "cancelamento");
    this.dados.cancelamento = { ...input, justificativa };
  }

  /**
   * A empresa desistiu de reenviar a rejeitada e inutilizou o número na SEFAZ.
   * A venda fica livre para emitir outra nota, com número novo.
   */
  inutilizar(inutilizacaoId: string): void {
    this.transitar("VOIDED", "inutilização");
    this.dados.inutilizacaoId = inutilizacaoId;
  }

  anexarArquivos(input: {
    xmlKey?: string | null;
    danfeKey?: string | null;
    xmlCancelamentoKey?: string | null;
  }): void {
    if (input.xmlKey) this.dados.xmlKey = input.xmlKey;
    if (input.danfeKey) this.dados.danfeKey = input.danfeKey;
    if (input.xmlCancelamentoKey)
      this.dados.xmlCancelamentoKey = input.xmlCancelamentoKey;
  }

  /** Para checar a regra sem mudar o estado (ex.: antes de chamar o provedor). */
  exigirPermite(status: StatusDocumentoFiscal, acao: string): void {
    if (!TRANSICOES[this.dados.status].includes(status))
      throw new TransicaoInvalidaError(this.dados.status, acao);
  }

  private transitar(para: StatusDocumentoFiscal, acao: string): void {
    this.exigirPermite(para, acao);
    this.dados.status = para;
  }
}
