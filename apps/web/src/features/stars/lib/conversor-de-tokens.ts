/**
 * De quanto custa o token ao quanto cobrar em ★.
 *
 * A conta que faltava para preencher o preço do Astro com alguma base, em vez
 * de chutar um inteiro. O caminho é sempre o mesmo:
 *
 *   preço do provedor (US$ por milhão de tokens)
 *     → custo de mil tokens em dólar
 *     → em real, pela cotação
 *     → dividido pelo que uma ★ vale em real
 *     → vezes a margem
 *     = ★ por mil tokens
 *
 * Puro e sem `server-only`: é uma calculadora de tela, e o resultado dela é um
 * palpite informado que alguém digita no campo de preço — não um valor que o
 * sistema grava sozinho. Preço de API muda, cotação muda, e um número que se
 * atualiza sozinho por trás da cobrança seria pior que um número velho.
 *
 * Entrada e saída são SEPARADAS porque todo provedor cobra diferente pelas
 * duas, e a saída costuma custar várias vezes mais. Uma média entre elas
 * erraria para mais em conversa curta e para menos em resposta longa.
 */

/** Quantos tokens o provedor usa como unidade de preço. */
const TOKENS_DO_PRECO = 1_000_000;

/** O bloco que o nerp cobra, igual ao de `custoDeTokens`. */
export const TOKENS_DO_BLOCO = 1_000;

export type PrecoDoProvedor = {
  /** US$ por milhão de tokens de ENTRADA. */
  entradaPorMilhao: number;
  /** US$ por milhão de tokens de SAÍDA. */
  saidaPorMilhao: number;
};

export type BaseDeConversao = {
  preco: PrecoDoProvedor;
  /** Quantos reais vale um dólar. */
  dolar: number;
  /** Quantos reais a organização paga por uma ★. */
  realPorEstrela: number;
  /** Quanto se cobra a mais que o custo. 1 = sem margem, 3 = o triplo. */
  margem: number;
  /**
   * Quanto da conversa é saída, de 0 a 1. O Astro fala menos do que lê — o
   * prompt carrega o índice das ferramentas em toda mensagem —, então o
   * padrão pende para a entrada.
   */
  proporcaoDeSaida: number;
};

export type ResultadoDaConversao = {
  /** US$ que mil tokens custam ao nerp, na mistura informada. */
  custoDolarPorMil: number;
  /** R$ que mil tokens custam ao nerp. */
  custoRealPorMil: number;
  /** O que cobrar por mil tokens, já com margem — o valor do campo. */
  estrelasPorMil: number;
  /** O mesmo, por cem tokens: a leitura mais fina que a pergunta pedia. */
  estrelasPorCem: number;
  /** Quantos tokens uma ★ compra, para conferir se o número faz sentido. */
  tokensPorEstrela: number;
};

/** Valores de partida. São CHUTE e precisam ser conferidos antes de valer. */
export const BASE_PADRAO: BaseDeConversao = {
  // Confira em ai.google.dev/pricing antes de usar: preço de API muda sem
  // avisar, e um número velho aqui vira prejuízo silencioso.
  preco: { entradaPorMilhao: 0.3, saidaPorMilhao: 2.5 },
  dolar: 5.5,
  realPorEstrela: 0.1,
  margem: 3,
  proporcaoDeSaida: 0.25,
};

export function converterTokensEmEstrelas(
  base: BaseDeConversao,
): ResultadoDaConversao {
  const saida = Math.min(1, Math.max(0, base.proporcaoDeSaida));
  const entrada = 1 - saida;

  const custoDolarPorMil =
    ((base.preco.entradaPorMilhao * entrada +
      base.preco.saidaPorMilhao * saida) *
      TOKENS_DO_BLOCO) /
    TOKENS_DO_PRECO;

  const custoRealPorMil = custoDolarPorMil * base.dolar;

  const estrelasPorMil =
    base.realPorEstrela > 0
      ? (custoRealPorMil / base.realPorEstrela) * base.margem
      : 0;

  return {
    custoDolarPorMil,
    custoRealPorMil,
    estrelasPorMil,
    estrelasPorCem: estrelasPorMil / 10,
    tokensPorEstrela:
      estrelasPorMil > 0 ? Math.round(TOKENS_DO_BLOCO / estrelasPorMil) : 0,
  };
}
