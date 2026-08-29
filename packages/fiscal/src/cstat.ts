/**
 * Códigos de retorno da SEFAZ (`cStat`) e o que fazer com cada um.
 *
 * A classificação existe porque o retry genérico do Inngest é ERRADO aqui.
 * Rejeição não é falha transitória: retransmitir o mesmo número depois de uma
 * rejeição definitiva não conserta nada, e retransmitir depois de um TIMEOUT é
 * o caminho clássico para emitir a mesma nota duas vezes.
 *
 * Quatro desfechos possíveis:
 *
 * - `ok`      — autorizada; persistir protocolo e seguir.
 * - `retry`   — problema momentâneo do lado da SEFAZ; reenviar o MESMO XML.
 * - `consult` — a SEFAZ pode já ter a nota. **Nunca reenviar**: consultar pela
 *               chave e usar o que voltar.
 * - `fatal`   — rejeição definitiva; o número está queimado e precisa de
 *               inutilização, e a nota tem de ser corrigida e reemitida.
 */

export type CStatDesfecho = "ok" | "retry" | "consult" | "fatal";

export type CStatInfo = {
  codigo: number;
  descricao: string;
  desfecho: CStatDesfecho;
};

const CATALOGO: readonly CStatInfo[] = [
  // ── autorizados ─────────────────────────────────────────────────────────
  { codigo: 100, descricao: "Autorizado o uso da NF-e", desfecho: "ok" },
  {
    codigo: 150,
    descricao: "Autorizado o uso da NF-e, autorização fora de prazo",
    desfecho: "ok",
  },
  // Evento (cancelamento/inutilização) homologado.
  {
    codigo: 135,
    descricao: "Evento registrado e vinculado à NF-e",
    desfecho: "ok",
  },
  {
    codigo: 136,
    descricao: "Evento registrado, mas não vinculado à NF-e",
    desfecho: "ok",
  },
  {
    codigo: 102,
    descricao: "Inutilização de número homologado",
    desfecho: "ok",
  },
  { codigo: 101, descricao: "Cancelamento de NF-e homologado", desfecho: "ok" },
  { codigo: 107, descricao: "Serviço em operação", desfecho: "ok" },

  // ── serviço indisponível: reenviar o mesmo XML mais tarde ───────────────
  {
    codigo: 108,
    descricao: "Serviço paralisado momentaneamente",
    desfecho: "retry",
  },
  {
    codigo: 109,
    descricao: "Serviço paralisado sem previsão",
    desfecho: "retry",
  },
  { codigo: 105, descricao: "Lote em processamento", desfecho: "retry" },
  { codigo: 106, descricao: "Lote não localizado", desfecho: "retry" },
  {
    codigo: 999,
    descricao: "Erro não catalogado no processamento da SEFAZ",
    desfecho: "retry",
  },
  {
    // Bloqueio por excesso de chamadas. Exige recuo longo (a SEFAZ costuma
    // liberar em uma hora) — retentar em segundos só prolonga o bloqueio.
    codigo: 656,
    descricao: "Consumo indevido (excesso de consultas/transmissões)",
    desfecho: "retry",
  },

  // ── a SEFAZ pode já ter a nota: CONSULTAR, jamais reenviar ──────────────
  {
    codigo: 204,
    descricao: "Duplicidade de NF-e (chave já autorizada)",
    desfecho: "consult",
  },
  {
    codigo: 539,
    descricao:
      "Duplicidade de NF-e com diferença na chave de acesso (mesmo número, dados divergentes)",
    desfecho: "consult",
  },
  {
    codigo: 563,
    descricao: "Já existe pedido de inutilização com a mesma faixa",
    desfecho: "consult",
  },

  // ── rejeições definitivas (amostra dos casos que mais aparecem) ─────────
  { codigo: 110, descricao: "Uso denegado", desfecho: "fatal" },
  {
    codigo: 205,
    descricao: "NF-e está denegada na base de dados",
    desfecho: "fatal",
  },
  { codigo: 206, descricao: "NF-e já está inutilizada", desfecho: "fatal" },
  { codigo: 207, descricao: "CNPJ do emitente inválido", desfecho: "fatal" },
  { codigo: 209, descricao: "IE do emitente inválida", desfecho: "fatal" },
  {
    codigo: 213,
    descricao: "CNPJ-Base do emitente difere do CNPJ do certificado",
    desfecho: "fatal",
  },
  { codigo: 225, descricao: "Falha no schema XML", desfecho: "fatal" },
  {
    codigo: 226,
    descricao: "UF do emitente diverge da UF autorizadora",
    desfecho: "fatal",
  },
  {
    codigo: 228,
    descricao: "Data de emissão muito atrasada",
    desfecho: "fatal",
  },
  { codigo: 229, descricao: "IE do emitente não informada", desfecho: "fatal" },
  {
    codigo: 236,
    descricao: "Chave de acesso com dígito verificador inválido",
    desfecho: "fatal",
  },
  {
    codigo: 239,
    descricao: "Versão do arquivo XML não suportada",
    desfecho: "fatal",
  },
  {
    codigo: 252,
    descricao: "Ambiente informado diverge do ambiente do webservice",
    desfecho: "fatal",
  },
  {
    codigo: 266,
    descricao: "Série utilizada fora da faixa permitida",
    desfecho: "fatal",
  },
  {
    codigo: 280,
    descricao: "Certificado transmissor inválido",
    desfecho: "fatal",
  },
  {
    codigo: 281,
    descricao: "Certificado transmissor com data de validade vencida",
    desfecho: "fatal",
  },
  {
    codigo: 290,
    descricao: "Certificado assinatura inválido",
    desfecho: "fatal",
  },
  {
    codigo: 297,
    descricao: "Assinatura difere do calculado",
    desfecho: "fatal",
  },
  {
    codigo: 298,
    descricao: "Assinatura difere do padrão do projeto",
    desfecho: "fatal",
  },
  {
    codigo: 301,
    descricao: "Uso denegado: irregularidade fiscal do emitente",
    desfecho: "fatal",
  },
  {
    codigo: 302,
    descricao: "Uso denegado: irregularidade fiscal do destinatário",
    desfecho: "fatal",
  },
  {
    codigo: 404,
    descricao: "Uso de prefixo de namespace não permitido",
    desfecho: "fatal",
  },
  {
    codigo: 445,
    descricao: "Parâmetro assinatura não deve ser informado no QR-Code",
    desfecho: "fatal",
  },
  {
    codigo: 464,
    descricao: "Código de Hash no QR-Code difere do calculado",
    desfecho: "fatal",
  },
  {
    codigo: 474,
    descricao: "Parâmetro assinatura deve ser informado no QR-Code",
    desfecho: "fatal",
  },
  {
    codigo: 496,
    descricao: "Assinatura do QR-Code difere do calculado",
    desfecho: "fatal",
  },
  {
    codigo: 610,
    descricao: "Total do produto difere do somatório dos itens",
    desfecho: "fatal",
  },
  { codigo: 611, descricao: "cEAN inválido", desfecho: "fatal" },
  {
    codigo: 855,
    descricao: "Assinatura do QR-Code difere do calculado",
    desfecho: "fatal",
  },
];

const POR_CODIGO = new Map(CATALOGO.map((item) => [item.codigo, item]));

/** Descrição e desfecho de um `cStat`, se catalogado. */
export function cStatInfo(codigo: number): CStatInfo | null {
  return POR_CODIGO.get(codigo) ?? null;
}

/**
 * O que fazer com um `cStat`.
 *
 * Códigos não catalogados na faixa 200-999 caem em `fatal`, não em `retry`:
 * é a escolha segura. Retentar um código desconhecido pode duplicar nota;
 * tratar como rejeição só exige intervenção humana.
 */
export function classificar(codigo: number): CStatDesfecho {
  const conhecido = POR_CODIGO.get(codigo);
  if (conhecido) return conhecido.desfecho;
  if (codigo >= 100 && codigo < 200) return "ok";
  return "fatal";
}

/**
 * Desfecho de uma CONSULTA por chave de acesso.
 *
 * Separado de `classificar` de propósito: o mesmo código significa coisas
 * diferentes conforme o serviço que respondeu. O caso que importa é o 217 —
 * numa consulta ele diz "esta nota NÃO existe aqui", que é exatamente a
 * autorização para reenviar depois de um timeout. Tratá-lo como rejeição
 * deixaria a venda sem nota; tratá-lo como autorização duplicaria a nota.
 */
export type ResultadoConsulta =
  | "autorizada"
  | "cancelada"
  | "denegada"
  | "inexistente"
  | "indefinido";

export function resultadoConsulta(codigo: number): ResultadoConsulta {
  if (codigo === 100 || codigo === 150) return "autorizada";
  if (codigo === 101 || codigo === 151 || codigo === 155) return "cancelada";
  if (codigo === 110 || codigo === 301 || codigo === 302 || codigo === 303)
    return "denegada";
  // 217 = não consta na base da SEFAZ; 999 aqui é falha da consulta, não da nota.
  if (codigo === 217) return "inexistente";
  return "indefinido";
}

/** Atalho de leitura para os pontos de decisão do orquestrador. */
export const autorizada = (codigo: number) => classificar(codigo) === "ok";
export const deveConsultar = (codigo: number) =>
  classificar(codigo) === "consult";
export const deveRetentar = (codigo: number) => classificar(codigo) === "retry";
