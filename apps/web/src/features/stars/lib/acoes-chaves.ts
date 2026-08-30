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
} as const;

export type AcaoCobravel = (typeof ACOES)[keyof typeof ACOES];
