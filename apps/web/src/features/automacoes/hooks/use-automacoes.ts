"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useAutomacoes(funnelId?: string) {
  return useQuery(orpc.automacoes.list.queryOptions({ input: { funnelId } }));
}

export function useAutomacao(workflowId: string | null) {
  return useQuery(
    orpc.automacoes.get.queryOptions({
      input: { workflowId: workflowId ?? "" },
      enabled: Boolean(workflowId),
    }),
  );
}

export function useExecucoes(workflowId: string | null) {
  return useQuery(
    orpc.automacoes.runs.queryOptions({
      input: { workflowId: workflowId ?? "", limite: 30 },
      enabled: Boolean(workflowId),
    }),
  );
}

export function useCriarAutomacao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.automacoes.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.automacoes.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSalvarGrafo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.automacoes.saveGraph.mutationOptions({
      onSuccess: () => {
        toast.success("Automação salva");
        queryClient.invalidateQueries({ queryKey: orpc.automacoes.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useLigarAutomacao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.automacoes.toggle.mutationOptions({
      onSuccess: (resultado) => {
        toast.success(
          resultado.isActive
            ? "Automação ligada"
            : "Automação desligada — nada mais dispara.",
        );
        queryClient.invalidateQueries({ queryKey: orpc.automacoes.key() });
      },
      // O erro aqui é o motivo de não poder ligar: é a informação mais útil da
      // tela e precisa aparecer inteira.
      onError: (error) => toast.error(error.message, { duration: 6000 }),
    }),
  );
}
