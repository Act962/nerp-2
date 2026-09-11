import type { OrgSegmentValue } from "@/lib/org-segment";
import type { SolucaoId } from "./solucoes";

/**
 * O segmento deduzido do que a pessoa marcou.
 *
 * Existe porque o ramo nem sempre responde: quem escolhe "Outro" — ou pula o
 * primeiro passo — não diz o que é, mas diz o que quer usar, e isso já separa
 * quem opera loja própria de quem trabalha o ponto de venda dos outros.
 *
 * O que o segmento decide é `SEGMENT_DEFAULT_DISABLED`, ou seja, quais módulos
 * nascem ESCONDIDOS. Errar aqui não bloqueia nada — o dono liga de volta em
 * dois cliques —, mas esconder o que a pessoa quer ver no primeiro minuto é a
 * pior primeira impressão possível. Por isso a regra é conservadora: só
 * estreita o segmento quando o sinal é claro, e no empate devolve `OUTRO`,
 * que não esconde nada.
 *
 * **Limite conhecido e assumido:** as ferramentas não separam indústria de
 * agência. As duas fazem trade, aprovam foto e montam book com as mesmas
 * telas. O que distingue de verdade é ter mercadoria — e isso a escolha de
 * Estoque responde. Agência nunca é deduzida automaticamente: é o segmento que
 * mais esconde (tira produtos e estoque), e chutá-lo sairia caro.
 */

/** Quem marca isto opera a própria loja. */
const DE_VAREJO: SolucaoId[] = [
  "pdv",
  "catalogo-promocional",
  "catalogo-online",
  "qr-preco",
  "pedidos",
];

/** Quem marca isto trabalha o ponto de venda — próprio ou dos outros. */
const DE_TRADE: SolucaoId[] = [
  "trade",
  "tradegram",
  "book",
  "planograma",
  "ranking",
];

/**
 * Estoque é o desempate entre distribuidor e indústria: os dois fazem trade, e
 * só um segura mercadoria. Fora do trade ele não vota — supermercado, clínica
 * e oficina têm estoque do mesmo jeito.
 */
const MERCADORIA: SolucaoId = "estoque";

export type SegmentoDeduzido = {
  segmento: OrgSegmentValue;
  /** Para a tela poder explicar, e para o teste poder cobrar o porquê. */
  motivo: "varejo" | "trade-com-estoque" | "trade-sem-estoque" | "sem-sinal";
};

export function segmentoPelasSolucoes(
  interesses: readonly SolucaoId[],
): SegmentoDeduzido {
  const marcadas = new Set(interesses);
  const varejo = DE_VAREJO.filter((id) => marcadas.has(id)).length;
  const trade = DE_TRADE.filter((id) => marcadas.has(id)).length;

  // Empate (inclusive zero a zero) não é sinal: quem só marcou WhatsApp,
  // financeiro e o Astro não disse de que lado está.
  if (varejo === trade) return { segmento: "OUTRO", motivo: "sem-sinal" };

  if (varejo > trade) return { segmento: "VAREJO", motivo: "varejo" };

  return marcadas.has(MERCADORIA)
    ? { segmento: "DISTRIBUIDOR", motivo: "trade-com-estoque" }
    : { segmento: "INDUSTRIA", motivo: "trade-sem-estoque" };
}
