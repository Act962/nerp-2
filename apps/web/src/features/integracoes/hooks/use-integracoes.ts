"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useIntegracoes() {
  return useQuery(orpc.integracoes.list.queryOptions({ input: {} }));
}

export function useInstalarIntegracao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.integracoes.install.mutationOptions({
      onSuccess: () => {
        toast.success("Integração conectada");
        queryClient.invalidateQueries({ queryKey: orpc.integracoes.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Sem toast: o resultado do teste aparece dentro do próprio dialog, junto do
// formulário que o usuário está preenchendo.
export function useTestarIntegracao() {
  return useMutation(orpc.integracoes.test.mutationOptions({}));
}

export function useRemoverIntegracao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.integracoes.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Integração removida");
        queryClient.invalidateQueries({ queryKey: orpc.integracoes.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePreviaIntegracao() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.integracoes.preview.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: orpc.integracoes.key() }),
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Logo é linha GLOBAL: quem edita é o super-admin, e o resultado aparece no
// catálogo de todas as organizações.
export function useDefinirLogoProvedor() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.integracoes.setProviderLogo.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.logoKey ? "Logo atualizada" : "Logo removida");
        queryClient.invalidateQueries({ queryKey: orpc.integracoes.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
