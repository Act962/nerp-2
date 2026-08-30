"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";
import { conversationChannel, funnelChannel } from "@/lib/realtime/channels";
import { useRealtimeChannel } from "@/lib/realtime/use-realtime-channel";

/**
 * Liga a tela aos eventos do servidor.
 *
 * Recarrega em vez de costurar a mensagem no cache à mão. O projeto de origem
 * faz a costura e paga o preço: a chave da lista de conversas tem oito
 * posições montadas à mão e precisa ser reconstruída igualzinha no tratador do
 * evento — filtro novo em um lugar e não no outro faz o realtime parar de
 * casar, silenciosamente.
 *
 * Recarregar é um pedido a mais e nenhuma chance de dessincronizar. Se o
 * volume justificar, dá para otimizar depois com medida na mão.
 */
export function useChatRealtime(input: {
  funnelId: string | null;
  conversationId: string | null;
}) {
  const queryClient = useQueryClient();

  const recarregarMensagens = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: orpc.message.key() });
    queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
  }, [queryClient]);

  const recarregarLista = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
  }, [queryClient]);

  // Canal da conversa aberta: mensagem nova, envio confirmado e tique.
  useRealtimeChannel(
    input.conversationId ? conversationChannel(input.conversationId) : null,
    {
      "message:new": recarregarMensagens,
      "message:created": recarregarMensagens,
      "message:updated": recarregarMensagens,
    },
  );

  // Canal do funil: conversa nova e mensagem em conversa que não está aberta —
  // é o que faz o badge de não-lidas subir sem precisar recarregar a página.
  useRealtimeChannel(input.funnelId ? funnelChannel(input.funnelId) : null, {
    "conversation:new": recarregarLista,
    "message:new": recarregarLista,
    "message:created": recarregarLista,
  });
}
