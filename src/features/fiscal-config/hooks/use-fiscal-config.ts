"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useFiscalConfig() {
  const query = useQuery(orpc.fiscalConfig.get.queryOptions({ input: {} }));
  return { config: query.data, isLoading: query.isPending };
}

export function useSaveFiscalConfig() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.fiscalConfig.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Configuração fiscal salva");
        queryClient.invalidateQueries({
          queryKey: orpc.fiscalConfig.get.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useTestSefaz() {
  return useMutation(
    orpc.fiscalConfig.testSefaz.mutationOptions({
      onSuccess: (data) => {
        if (data.ok)
          toast.success(
            `SEFAZ PI respondeu (${data.status}, ${data.latencyMs}ms)`,
          );
        else
          toast.error(
            data.message ??
              `SEFAZ PI: sem resposta (${data.status || "timeout"})`,
            { duration: 8000 },
          );
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useTestProvider() {
  return useMutation(
    orpc.fiscalConfig.testProvider.mutationOptions({
      onSuccess: (data) => {
        if (data.ok)
          toast.success(
            `Focus NFe respondeu (${data.status}, ${data.latencyMs}ms)`,
          );
        else toast.error(data.message ?? "Falha ao chamar o provedor");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
