/**
 * Chaves das ações cobráveis.
 *
 * Módulo neutro, sem `server-only`: a tela de preços é client component e
 * precisa das mesmas chaves que o motor de cobrança usa. Uma segunda lista do
 * lado do cliente seria a forma mais fácil de a tela gravar preço para uma
 * chave que ninguém cobra.
 */
export const ACOES = {
  mensagemEnviada: "message_send",
  destinatarioDeCampanha: "campaign_recipient",
  /** Astro: cobrado por bloco de 1.000 tokens (entrada + saída) da resposta. */
  astroTokens: "astro_tokens_1k",
} as const;

export type AcaoCobravel = (typeof ACOES)[keyof typeof ACOES];

/**
 * Preço de quem nunca cadastrou regra.
 *
 * O WhatsApp nasce desligado de propósito (ver `debitar.ts`): sem regra, não
 * cobra. O Astro é o contrário — ele gasta token de LLM em toda resposta, e
 * uma organização que não pagasse nada por isso seria conta de API aberta. Por
 * isso ele tem preço padrão; a `StarRule`, quando existir, continua mandando,
 * inclusive para desligar com zero.
 */
export const PRECOS_PADRAO: Partial<Record<AcaoCobravel, number>> = {
  [ACOES.astroTokens]: 1,
};
