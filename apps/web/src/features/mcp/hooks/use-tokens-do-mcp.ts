"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useTokensDoMcp(habilitado: boolean) {
  return useQuery(
    orpc.mcp.tokens.listar.queryOptions({
      input: {},
      enabled: habilitado,
    }),
  );
}

// Sem toast de sucesso: o token aparece na própria janela, que é onde a pessoa
// precisa copiá-lo.
export function useCriarTokenDoMcp() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mcp.tokens.criar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.mcp.tokens.listar.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRevogarTokenDoMcp() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mcp.tokens.revogar.mutationOptions({
      onSuccess: () => {
        toast.success("Token revogado: o agente perde o acesso na hora");
        queryClient.invalidateQueries({
          queryKey: orpc.mcp.tokens.listar.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useAlterarImportacaoDoToken() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mcp.tokens.alterarImportacao.mutationOptions({
      onSuccess: (resposta) => {
        toast.success(
          resposta.importar
            ? "Importação liberada: o agente pode gravar no NERP"
            : "Importação desligada: o agente só mapeia",
        );
        queryClient.invalidateQueries({
          queryKey: orpc.mcp.tokens.listar.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
