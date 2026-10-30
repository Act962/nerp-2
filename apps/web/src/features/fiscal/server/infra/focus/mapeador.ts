import {
  type RespostaEmissao,
  type SolicitacaoEmissao,
  TPAG,
  calcularTotais,
  formatarDhEmi,
  somenteDigitos,
  valorBrutoItem,
} from "@nerp/fiscal";

/**
 * `NotaFiscal` → corpo do `POST /v2/nfce` da Focus, e resposta da Focus →
 * `RespostaEmissao`. Puro: é o único lugar que conhece o vocabulário da Focus.
 *
 * Campos conferidos na documentação pública (doc.focusnfe.com.br, out/2026):
 * cabeçalho, `items` (ncm, cfop, quantidades, valores, unidades, icms_origem,
 * icms_situacao_tributaria) e `formas_pagamento`. `pis_situacao_tributaria` e
 * `cofins_situacao_tributaria` vêm da referência da NF-e. `cest`,
 * `codigo_barras_*`, `valor_troco` e `valor_total_tributos` (o `vTotTrib` do
 * item) não aparecem nas páginas públicas — o teste de contrato contra a
 * homologação é quem confirma.
 */

/** Exigência da SEFAZ para NFC-e de teste (sem isto: rejeição 373). */
export const DESCRICAO_HOMOLOGACAO =
  "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

const reais = (centavos: number) => Math.round(centavos) / 100;

export type ItemFocus = {
  numero_item: string;
  codigo_produto: string;
  descricao: string;
  codigo_ncm: string;
  cest?: string;
  cfop: string;
  unidade_comercial: string;
  unidade_tributavel: string;
  quantidade_comercial: number;
  quantidade_tributavel: number;
  valor_unitario_comercial: number;
  valor_unitario_tributavel: number;
  valor_bruto: number;
  valor_desconto?: number;
  codigo_barras_comercial: string;
  codigo_barras_tributavel: string;
  icms_origem: string;
  icms_situacao_tributaria: string;
  pis_situacao_tributaria: string;
  cofins_situacao_tributaria: string;
  valor_total_tributos?: number;
};

export type PagamentoFocus = {
  forma_pagamento: string;
  valor_pagamento: number;
  /** 2 = pagamento com cartão não integrado ao sistema (sem TEF). */
  tipo_integracao?: "2";
};

export type PedidoNfceFocus = {
  cnpj_emitente: string;
  data_emissao: string;
  natureza_operacao: string;
  presenca_comprador: "1";
  modalidade_frete: "9";
  local_destino: "1";
  indicador_inscricao_estadual_destinatario: "9";
  serie: string;
  numero: string;
  cpf_destinatario?: string;
  cnpj_destinatario?: string;
  nome_destinatario?: string;
  informacoes_adicionais_contribuinte?: string;
  valor_troco?: number;
  items: ItemFocus[];
  formas_pagamento: PagamentoFocus[];
};

export function paraPedidoFocus(s: SolicitacaoEmissao): PedidoNfceFocus {
  const { nota } = s;
  const homologacao = nota.ambiente === "HOMOLOGACAO";
  const documento = nota.destinatario
    ? somenteDigitos(nota.destinatario.documento)
    : null;
  const { troco } = calcularTotais(nota);

  return {
    cnpj_emitente: somenteDigitos(nota.emitente.cnpj),
    data_emissao: formatarDhEmi(s.emitidaEm),
    natureza_operacao: "VENDA AO CONSUMIDOR",
    presenca_comprador: "1",
    modalidade_frete: "9",
    local_destino: "1",
    indicador_inscricao_estadual_destinatario: "9",
    serie: String(s.serie),
    numero: String(s.numero),
    ...(documento?.length === 11 && { cpf_destinatario: documento }),
    ...(documento?.length === 14 && { cnpj_destinatario: documento }),
    ...(nota.destinatario?.nome && {
      nome_destinatario: nota.destinatario.nome,
    }),
    ...(nota.informacoesAdicionais && {
      informacoes_adicionais_contribuinte: nota.informacoesAdicionais,
    }),
    ...(troco > 0 && { valor_troco: reais(troco) }),
    items: nota.itens.map((item, i) => {
      const gtin = item.gtin ?? "SEM GTIN";
      const icms =
        item.tributacao.icms.regime === "SIMPLES"
          ? item.tributacao.icms.csosn
          : item.tributacao.icms.cst;
      return {
        numero_item: String(i + 1),
        codigo_produto: item.codigo,
        descricao:
          homologacao && i === 0 ? DESCRICAO_HOMOLOGACAO : item.descricao,
        codigo_ncm: item.ncm,
        ...(item.cest && { cest: item.cest }),
        cfop: item.cfop,
        unidade_comercial: item.unidade,
        unidade_tributavel: item.unidade,
        quantidade_comercial: item.quantidade,
        quantidade_tributavel: item.quantidade,
        valor_unitario_comercial: reais(item.valorUnitario),
        valor_unitario_tributavel: reais(item.valorUnitario),
        valor_bruto: reais(valorBrutoItem(item)),
        ...(item.desconto > 0 && { valor_desconto: reais(item.desconto) }),
        codigo_barras_comercial: gtin,
        codigo_barras_tributavel: gtin,
        icms_origem: item.tributacao.origem,
        icms_situacao_tributaria: icms,
        pis_situacao_tributaria: item.tributacao.pis.cst,
        cofins_situacao_tributaria: item.tributacao.cofins.cst,
        ...(item.tributosAproximados != null && {
          valor_total_tributos: reais(item.tributosAproximados),
        }),
      };
    }),
    formas_pagamento: nota.pagamentos.map((p) => ({
      forma_pagamento: TPAG[p.forma],
      valor_pagamento: reais(p.valor),
      ...((p.forma === "CREDITO" || p.forma === "DEBITO") && {
        tipo_integracao: "2" as const,
      }),
    })),
  };
}

/** O que a Focus devolve no POST e no GET de uma NFC-e. */
export type RespostaNfceFocus = {
  status?: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: string;
  serie?: string;
  protocolo?: string;
  numero_protocolo?: string;
  caminho_xml_nota_fiscal?: string;
  qrcode_url?: string;
  url_consulta_nf?: string;
};

export type DadosDoXml = {
  protocolo: string | null;
  autorizadaEm: Date | null;
};

/** Protocolo e data de autorização saem do próprio XML autorizado. */
export function lerProtocoloDoXml(xml: string): DadosDoXml {
  const protocolo = /<nProt>(\d+)<\/nProt>/.exec(xml)?.[1] ?? null;
  const dh = /<dhRecbto>([^<]+)<\/dhRecbto>/.exec(xml)?.[1];
  const data = dh ? new Date(dh) : null;
  return {
    protocolo,
    autorizadaEm: data && !Number.isNaN(data.getTime()) ? data : null,
  };
}

/**
 * Situação da Focus → `RespostaEmissao`. Para a autorizada, quem chama
 * completa com o XML baixado (protocolo e data vêm dele).
 */
export function situacaoDaFocus(
  r: RespostaNfceFocus,
):
  | { tipo: "AUTORIZADA" }
  | { tipo: "PROCESSANDO" }
  | Extract<RespostaEmissao, { situacao: "REJEITADA" | "DENEGADA" }> {
  switch (r.status) {
    case "autorizado":
    // Cancelada depois de autorizada: para a emissão, o desfecho foi autorizar.
    case "cancelado":
      return { tipo: "AUTORIZADA" };
    case "denegado":
      return {
        situacao: "DENEGADA",
        codigo: r.status_sefaz ?? "000",
        motivo: r.mensagem_sefaz ?? "Uso denegado",
      };
    case "erro_autorizacao":
      return {
        situacao: "REJEITADA",
        codigo: r.status_sefaz ?? "000",
        motivo: r.mensagem_sefaz ?? "Rejeitada pela SEFAZ",
      };
    default:
      return { tipo: "PROCESSANDO" };
  }
}
