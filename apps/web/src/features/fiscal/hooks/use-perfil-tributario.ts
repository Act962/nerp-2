"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Regime e padrões de tributação da empresa (sem segredos). */
export function usePerfilTributario() {
  return useQuery(orpc.fiscalConfig.taxProfile.queryOptions({ input: {} }));
}

export function useProntidaoFiscal(search?: string) {
  return useQuery(
    orpc.products.fiscalReadiness.queryOptions({
      input: { search: search || undefined },
    }),
  );
}

export function useEditarFiscalEmLote() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.products.bulkUpdateFiscal.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.updated === 1
            ? "1 produto atualizado"
            : `${data.updated} produtos atualizados`,
        );
        queryClient.invalidateQueries({
          queryKey: orpc.products.fiscalReadiness.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.products.key() });
      },
      onError: (error) => toast.error(error.message, { duration: 8000 }),
    }),
  );
}
