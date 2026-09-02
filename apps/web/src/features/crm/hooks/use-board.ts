"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useBoard(input: {
  funnelId: string | null;
  busca?: string;
  temperatura?: "COLD" | "WARM" | "HOT" | "VERY_HOT";
}) {
  return useQuery(
    orpc.crm.lead.list.queryOptions({
      input: {
        funnelId: input.funnelId ?? "",
        busca: input.busca,
        temperatura: input.temperatura,
        porEtapa: 50,
      },
      enabled: Boolean(input.funnelId),
    }),
  );
}

/**
 * Move o card.
 *
 * Sem atualização otimista de propósito: o servidor é quem calcula a posição a
 * partir dos vizinhos reais, e fingir aqui um número que ele pode não gravar
 * faria o card pular de lugar depois — pior que esperar a resposta. O arrasto
 * já dá a sensação de imediato; a lista se acerta em seguida.
 */
export function useMoverCard() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.lead.move.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
