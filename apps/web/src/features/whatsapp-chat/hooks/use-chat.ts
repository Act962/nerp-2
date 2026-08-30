"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/**
 * Caixa de entrada, paginada por cursor.
 *
 * A lista se reordena sozinha conforme chega mensagem — por isso cursor e não
 * página numerada: com `skip/take`, uma conversa que sobe para o topo apareceria
 * duas vezes na rolagem.
 */
export function useConversas(input: {
  funnelId: string | null;
  busca?: string;
  statusFlow?: "NEW" | "ACTIVE" | "WAITING" | "FINISHED";
}) {
  return useInfiniteQuery(
    orpc.conversation.list.infiniteOptions({
      input: (cursor: string | undefined) => ({
        funnelId: input.funnelId ?? "",
        busca: input.busca,
        statusFlow: input.statusFlow,
        cursor,
        limite: 20,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
      enabled: Boolean(input.funnelId),
      staleTime: 30_000,
    }),
  );
}

/** Mensagens da conversa aberta, da mais nova para a mais antiga. */
export function useMensagens(conversationId: string | null) {
  return useInfiniteQuery(
    orpc.message.list.infiniteOptions({
      input: (cursor: string | undefined) => ({
        conversationId: conversationId ?? "",
        cursor,
        limite: 30,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
      enabled: Boolean(conversationId),
    }),
  );
}

export function useEnviarMensagem() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.message.send.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.message.key() });
        queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * Zera o badge de não-lidas ao abrir a conversa. Silencioso de propósito: é
 * efeito de navegação, não ação do usuário — um toast a cada conversa aberta
 * seria ruído.
 */
export function useMarcarComoLida() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.conversation.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
      },
    }),
  );
}
