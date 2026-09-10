"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useOnboardingStatus() {
  return useQuery(
    orpc.onboarding.status.queryOptions({ input: {}, staleTime: 60_000 }),
  );
}

export function useRemoverDadosDeExemplo() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.onboarding.removerDadosDeExemplo.mutationOptions({
      onSuccess: (resultado) => {
        const total =
          resultado.produtos +
          resultado.clientes +
          resultado.fornecedores +
          resultado.lojas +
          resultado.catalogos;
        toast.success(
          resultado.mantidos > 0
            ? `${total} registros de exemplo removidos; ${resultado.mantidos} já tinham movimento e ficaram.`
            : `${total} registros de exemplo removidos.`,
        );
        // Mexeu em produtos, clientes, fornecedores, lojas e catálogos de uma
        // vez: invalidar lista por lista é esquecer uma.
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );
}
