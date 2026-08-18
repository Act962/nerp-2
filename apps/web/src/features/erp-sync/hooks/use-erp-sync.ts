"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

// Enquanto sincroniza, pergunta de 3 em 3s para o badge sair de "sincronizando"
// sozinho; parado, 60s basta — o cron roda de 15 em 15 min.
const POLL_WHILE_SYNCING_MS = 3_000;
const POLL_IDLE_MS = 60_000;

export function useErpSyncStatus() {
  return useQuery(
    orpc.erpSync.status.queryOptions({
      input: {},
      refetchInterval: (query) =>
        query.state.data?.configured && query.state.data.isSyncing
          ? POLL_WHILE_SYNCING_MS
          : POLL_IDLE_MS,
    }),
  );
}

export function useRunErpSync() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.erpSync.run.mutationOptions({
      onSuccess: () => {
        toast.success("Sincronização iniciada");
        // O status muda primeiro (vira "sincronizando"); o ranking só depois que
        // o job terminar, mas invalidar os dois deixa a tela reagir sozinha.
        queryClient.invalidateQueries({ queryKey: orpc.erpSync.key() });
        queryClient.invalidateQueries({ queryKey: orpc.ranking.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Config da conexão para o formulário de Integrações (sem a senha).
export function useErpConnection() {
  return useQuery(orpc.erpSync.getConnection.queryOptions({ input: {} }));
}

export function useSaveErpConnection() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.erpSync.saveConnection.mutationOptions({
      onSuccess: () => {
        toast.success("Conexão salva");
        queryClient.invalidateQueries({ queryKey: orpc.erpSync.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Não usa toast: a tela de Integrações mostra o resultado (ok/erro) inline,
// com a contagem de vendedores ou a mensagem do Oracle.
export function useTestErpConnection() {
  return useMutation(orpc.erpSync.testConnection.mutationOptions({}));
}

export function usePauseErpConnection() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.erpSync.setPaused.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.paused ? "Sincronização pausada" : "Sincronização retomada",
        );
        queryClient.invalidateQueries({ queryKey: orpc.erpSync.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRemoveErpConnection() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.erpSync.removeConnection.mutationOptions({
      onSuccess: () => {
        toast.success("Conexão removida");
        queryClient.invalidateQueries({ queryKey: orpc.erpSync.key() });
        queryClient.invalidateQueries({ queryKey: orpc.ranking.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
