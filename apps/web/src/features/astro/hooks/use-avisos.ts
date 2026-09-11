"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/**
 * Os avisos do Astro, para o mascote e para a central.
 *
 * Um minuto de `refetchInterval`: os avisos nascem num cron três vezes ao dia,
 * então perguntar de minuto em minuto já é generoso — e é o bastante para o
 * selo aparecer sem a pessoa recarregar a página.
 */
export function useAvisos() {
  return useQuery(
    orpc.astro.avisos.listar.queryOptions({
      input: { apenasNaoLidos: false, limite: 20 },
      refetchInterval: 60_000,
      staleTime: 30_000,
    }),
  );
}

function useInvalidarAvisos() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.astro.avisos.listar.key() });
}

export function useMarcarAvisoLido() {
  const invalidar = useInvalidarAvisos();
  return useMutation(
    orpc.astro.avisos.marcarLido.mutationOptions({
      onSuccess: invalidar,
      onError: (erro) => toast.error(erro.message),
    }),
  );
}

/**
 * Marcar como falado não avisa ninguém quando falha: é escrita de bastidor,
 * disparada pelo balão do mascote. Um toast de erro aqui seria um pop-up
 * sobre algo que a pessoa nem pediu.
 */
export function useMarcarAvisoFalado() {
  const invalidar = useInvalidarAvisos();
  return useMutation(
    orpc.astro.avisos.marcarFalado.mutationOptions({ onSuccess: invalidar }),
  );
}

export function useMarcarTodosLidos() {
  const invalidar = useInvalidarAvisos();
  return useMutation(
    orpc.astro.avisos.marcarTodosLidos.mutationOptions({
      onSuccess: invalidar,
      onError: (erro) => toast.error(erro.message),
    }),
  );
}

export function useMemorias() {
  return useQuery(
    orpc.astro.memorias.listar.queryOptions({ input: {}, staleTime: 30_000 }),
  );
}

export function useEsquecerMemoria() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.astro.memorias.esquecer.mutationOptions({
      onSuccess: () => {
        toast.success("Esqueci isso");
        queryClient.invalidateQueries({
          queryKey: orpc.astro.memorias.listar.key(),
        });
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );
}
