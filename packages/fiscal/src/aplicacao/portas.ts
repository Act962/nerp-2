import type { ModeloDocumento } from "../core/chave";
import type { DocumentoFiscal } from "../dominio/documento-fiscal";
import type {
  Ambiente,
  Destinatario,
  NotaFiscal,
} from "../dominio/nota-fiscal";

/**
 * Portas: o que os casos de uso PRECISAM do mundo, sem saber quem entrega.
 *
 * Cada porta é uma interface pequena. Do lado de `apps/web` ficam os
 * adaptadores reais (Prisma, Focus NFe, R2, Inngest); nos testes, os de
 * memória de `@nerp/fiscal/testes`. Trocar a Focus por outro provedor é
 * escrever um novo `ProvedorFiscal` e fazê-lo passar no teste de contrato
 * (`@nerp/fiscal/testes/contrato`) — nenhum caso de uso muda.
 */

// ── Provedor de emissão ────────────────────────────────────────────────────

export type ArquivoFiscal = {
  bytes: Uint8Array;
  contentType: "application/xml" | "application/pdf";
};

export type SolicitacaoEmissao = {
  /**
   * Identificador estável da nota no provedor — o id do `DocumentoFiscal`.
   * É ele que torna o reenvio seguro: mesma `ref`, mesma nota.
   */
  ref: string;
  serie: number;
  numero: number;
  /**
   * Hora da emissão (`dhEmi`). Definida a CADA envio, não na criação do
   * documento: a SEFAZ rejeita NFC-e com emissão atrasada (rejeição 704), e
   * um reenvio uma hora depois com a hora original seria recusado.
   */
  emitidaEm: Date;
  nota: NotaFiscal;
};

export type RespostaEmissao =
  | {
      situacao: "AUTORIZADA";
      chave: string;
      protocolo: string;
      autorizadaEm: Date;
      xml?: ArquivoFiscal | null;
      danfe?: ArquivoFiscal | null;
      /** Conteúdo do QR do DANFCe e a URL de consulta da UF. */
      qrCodeUrl?: string | null;
      consultaUrl?: string | null;
    }
  /** Recebida, a SEFAZ ainda não respondeu — consultar depois. */
  | { situacao: "PROCESSANDO" }
  | { situacao: "REJEITADA"; codigo: string; motivo: string }
  | { situacao: "DENEGADA"; codigo: string; motivo: string };

export type SolicitacaoCancelamento = {
  ref: string;
  modelo: ModeloDocumento;
  chave: string;
  justificativa: string;
};

export type RespostaCancelamento =
  | {
      situacao: "CANCELADA";
      protocolo: string;
      canceladaEm: Date;
      /** XML do evento de cancelamento, quando o provedor entrega. */
      xml?: ArquivoFiscal | null;
    }
  | { situacao: "RECUSADA"; codigo: string; motivo: string };

export type SolicitacaoInutilizacao = {
  modelo: ModeloDocumento;
  cnpj: string;
  serie: number;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
};

export type RespostaInutilizacao =
  | {
      situacao: "INUTILIZADA";
      protocolo: string;
      inutilizadaEm: Date;
      xml?: ArquivoFiscal | null;
    }
  | { situacao: "RECUSADA"; codigo: string; motivo: string };

/**
 * Contrato de QUALQUER provedor (Focus, outro SaaS, emissor próprio):
 *
 * 1. `emitir` com uma `ref` já recebida NÃO cria outra nota: devolve a
 *    situação atual daquela ref. A exceção é a ref REJEITADA: aí o conteúdo
 *    novo é processado — é o reenvio depois de corrigir o cadastro, e a
 *    rejeição não consumiu o número na SEFAZ.
 * 2. Rejeição da SEFAZ é RESPOSTA (`REJEITADA`), nunca exceção.
 * 3. Falha de rede, timeout ou 5xx lança `ProvedorIndisponivelError`.
 * 4. `consultar` de uma ref nunca enviada lança `ReferenciaDesconhecidaError`.
 * 5. `inutilizar` recusado pela SEFAZ (faixa já usada) também é RESPOSTA.
 */
export interface ProvedorFiscal {
  readonly nome: string;
  emitir(solicitacao: SolicitacaoEmissao): Promise<RespostaEmissao>;
  consultar(ref: string, modelo: ModeloDocumento): Promise<RespostaEmissao>;
  cancelar(solicitacao: SolicitacaoCancelamento): Promise<RespostaCancelamento>;
  inutilizar(
    solicitacao: SolicitacaoInutilizacao,
  ): Promise<RespostaInutilizacao>;
}

/**
 * O provedor depende da organização: cada cliente tem o seu token, o seu
 * certificado e, um dia, talvez o seu provedor. É aqui que a infra lê o
 * `FiscalConfig.provider` e devolve o adaptador certo.
 */
export interface ProvedoresFiscais {
  daOrganizacao(organizationId: string): Promise<ProvedorFiscal>;
}

// ── Persistência ───────────────────────────────────────────────────────────

export interface RepositorioDocumentoFiscal {
  buscarPorId(
    organizationId: string,
    id: string,
  ): Promise<DocumentoFiscal | null>;
  /** Documento da venda que ainda vale (fora de `STATUS_FORA_DE_VIGOR`). */
  buscarVigenteDaVenda(
    organizationId: string,
    saleId: string,
    modelo: ModeloDocumento,
  ): Promise<DocumentoFiscal | null>;
  /** Documentos da série com número dentro da faixa (qualquer status). */
  listarDaFaixa(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
    numeroInicial: number;
    numeroFinal: number;
  }): Promise<DocumentoFiscal[]>;
  salvar(documento: DocumentoFiscal): Promise<void>;
}

/** Faixa de números inutilizada na SEFAZ. Registro definitivo, nunca editado. */
export type Inutilizacao = {
  id: string;
  organizationId: string;
  modelo: ModeloDocumento;
  ambiente: Ambiente;
  serie: number;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
  protocolo: string;
  inutilizadaEm: Date;
  xmlKey: string | null;
};

export interface RepositorioInutilizacao {
  salvar(inutilizacao: Inutilizacao): Promise<void>;
  listarDaSerie(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }): Promise<Inutilizacao[]>;
}

/**
 * Numeração por série, atômica. O NERP é dono da sequência — não o provedor —
 * para a série offline de cada caixa conviver com a série online.
 */
export interface NumeracaoFiscal {
  reservar(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }): Promise<number>;
  /** Próximo número sem reservar; `null` se a série nunca foi usada. */
  proximo(input: {
    organizationId: string;
    modelo: ModeloDocumento;
    serie: number;
  }): Promise<number | null>;
}

export type VendaParaNota = {
  nota: NotaFiscal;
  serie: number;
};

/**
 * Lê a venda e o cadastro fiscal e devolve a nota pronta (sem número). É o
 * tradutor entre o mundo do ERP (Sale, Product, FiscalConfig, Decimal) e o
 * domínio fiscal (centavos, CSOSN, CFOP).
 */
export interface MontadorDeNota {
  montar(input: {
    organizationId: string;
    saleId: string;
    modelo: ModeloDocumento;
    /**
     * "CPF na nota" informado no caixa. `undefined` = usar o documento do
     * cliente vinculado à venda; `null` = consumidor não identificado.
     */
    destinatario?: Destinatario | null;
  }): Promise<VendaParaNota | null>;
}

export type TipoArquivoFiscal =
  | "xml"
  | "danfe"
  | "xml-cancelamento"
  | "xml-inutilizacao";

export interface ArmazenamentoFiscal {
  /** Guarda no bucket fiscal privado e devolve a key. */
  guardar(input: {
    organizationId: string;
    /** Id do documento — ou da inutilização — dono do arquivo. */
    documentoId: string;
    tipo: TipoArquivoFiscal;
    arquivo: ArquivoFiscal;
  }): Promise<string>;
}

// ── Utilidades injetadas (para o teste controlar tempo e ids) ──────────────

export interface Relogio {
  agora(): Date;
}

export interface GeradorDeId {
  gerar(): string;
}
