"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useLead(leadId: string | null) {
  return useQuery(
    orpc.crm.lead.get.queryOptions({
      input: { leadId: leadId ?? "" },
      enabled: Boolean(leadId),
    }),
  );
}

export function useEtapas(funnelId: string | null) {
  return useQuery(
    orpc.crm.stage.list.queryOptions({
      input: { funnelId: funnelId ?? "" },
      enabled: Boolean(funnelId),
      // Etapa quase não muda; recarregar a cada foco da janela é desperdício.
      staleTime: 5 * 60_000,
    }),
  );
}

export function useAtualizarLead() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.lead.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
        // A lista de conversas mostra nome e estado do atendimento.
        queryClient.invalidateQueries({ queryKey: orpc.conversation.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
