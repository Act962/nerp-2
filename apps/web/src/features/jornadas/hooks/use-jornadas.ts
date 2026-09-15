"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useInvalidarSaldo } from "@/features/stars/hooks/use-stars";
import { orpc } from "@/lib/orpc";

/**
 * As jornadas guiadas do ponto de vista de quem está logado.
 *
 * `listar` é consultada em toda tela (o convite flutuante pergunta se esta
 * página tem jornada pendente), então tem `staleTime` — o catálogo muda quando
 * há deploy, não a cada navegação.
 */
export function useJornadas() {
  return useQuery(
    orpc.jornadas.listar.queryOptions({ input: {}, staleTime: 60_000 }),
  );
}

export function useIniciarJornada() {
  return useMutation(
    orpc.jornadas.iniciar.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

/**
 * O checkpoint de bastidor: grava em que passo a pessoa está.
 *
 * Sem toast e sem invalidação de propósito — é ruído de fundo, dispara a cada
 * passo, e só existe para quem fecha a aba no meio poder voltar depois.
 */
export function useAvancarJornada() {
  return useMutation(orpc.jornadas.avancar.mutationOptions({}));
}

export function useConcluirJornada() {
  const queryClient = useQueryClient();
  const invalidarSaldo = useInvalidarSaldo();
  return useMutation(
    orpc.jornadas.concluir.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.jornadas.listar.key() });
        // As ★ entram no saldo da empresa: o painel da sidebar precisa saber.
        invalidarSaldo();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useEnviarMelhoria() {
  return useMutation(
    orpc.melhorias.enviar.mutationOptions({
      onSuccess: () =>
        toast.success("Obrigado! Sua sugestão chegou à equipe da ÓRBITA"),
      onError: (error) => toast.error(error.message),
    }),
  );
}
