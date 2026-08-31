"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useCampanhas(funnelId: string | null) {
  return useQuery(
    orpc.campanhas.list.queryOptions({
      input: { funnelId: funnelId ?? undefined },
      enabled: Boolean(funnelId),
    }),
  );
}

/**
 * Detalhe da campanha.
 *
 * Enquanto está disparando, recarrega a cada dois segundos: o progresso vem do
 * job, que roda fora desta aba, e sem isso o operador ficaria olhando números
 * congelados sem saber se travou. Ao terminar, o polling para sozinho.
 */
export function useCampanha(broadcastId: string | null) {
  return useQuery(
    orpc.campanhas.get.queryOptions({
      input: { broadcastId: broadcastId ?? "" },
      enabled: Boolean(broadcastId),
      refetchInterval: (query) =>
        query.state.data?.status === "SENDING" ? 2000 : false,
    }),
  );
}

export function useTemplates(funnelId: string | null) {
  return useQuery(
    orpc.campanhas.listTemplates.queryOptions({
      input: { funnelId: funnelId ?? "" },
      enabled: Boolean(funnelId),
      staleTime: 5 * 60_000,
    }),
  );
}

export function useCriarCampanha() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.create.mutationOptions({
      onSuccess: () => {
        toast.success("Campanha criada");
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAdicionarDestinatarios() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.addRecipientsFromLeads.mutationOptions({
      onSuccess: (resultado) => {
        const partes = [`${resultado.adicionados} adicionado(s)`];
        if (resultado.jaEstavam > 0)
          partes.push(`${resultado.jaEstavam} já estava(m)`);
        if (resultado.semTelefone > 0)
          partes.push(`${resultado.semTelefone} sem telefone`);
        toast.success(partes.join(" · "));
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useEscolherTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.setTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Template escolhido");
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDispararCampanha() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.send.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          `Disparando para ${resultado.destinatarios} destinatário(s)`,
        );
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
