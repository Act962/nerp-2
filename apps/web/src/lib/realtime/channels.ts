/**
 * Nomes de canal de realtime.
 *
 * Duas regras que valem para todo canal novo:
 *
 * 1. **Sempre `private-`.** Canal sem esse prefixo o Pusher entrega para
 *    qualquer um que saiba o nome, sem passar pelo `/api/pusher/auth`. No
 *    Órbita os canais do chat são o id cru da conversa — quem descobre um
 *    `conversationId` lê as mensagens daquele atendimento. Aqui não: todo
 *    canal é privado e passa por um `ChannelAuthorizer`.
 * 2. **Sempre com o prefixo `nerp-`.** O app do Pusher pode ser o mesmo do
 *    Órbita; o prefixo mantém os dois legíveis no painel e impede que um
 *    authorizer de lá reconheça um canal daqui.
 *
 * Canal novo = uma função aqui + um authorizer em `channel-authorizers.ts`.
 * Sem o authorizer a subscription é rejeitada com 403 — silenciosamente, do
 * ponto de vista da UI.
 */

const PREFIXO = "private-nerp";

/** Tudo que acontece dentro de uma conversa: mensagem nova, tick, edição. */
export function conversationChannel(conversationId: string): string {
  return `${PREFIXO}-conversation-${conversationId}`;
}

/** Eventos do funil: conversa nova, lead movido, lead atribuído. */
export function funnelChannel(funnelId: string): string {
  return `${PREFIXO}-funnel-${funnelId}`;
}

/** Eventos que interessam à organização inteira. */
export function orgChannel(organizationId: string): string {
  return `${PREFIXO}-org-${organizationId}`;
}

/** Extrai o id de um canal, ou `null` se o nome não casa com o tipo. */
export function idDoCanal(channel: string, tipo: string): string | null {
  const match = new RegExp(`^${PREFIXO}-${tipo}-(.+)$`).exec(channel);
  return match?.[1] ?? null;
}
