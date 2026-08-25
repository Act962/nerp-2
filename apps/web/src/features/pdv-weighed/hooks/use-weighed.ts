"use client";

import { client, orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEFAULT_WEIGHED_CONFIG } from "../weighed-barcode";

export function usePdvWeighedConfig() {
  const query = useQuery(
    orpc.pdvSettings.getWeighed.queryOptions({ input: {} }),
  );
  return {
    config: query.data?.config ?? DEFAULT_WEIGHED_CONFIG,
    isLoading: query.isPending,
  };
}

export function useUpdatePdvWeighedConfig() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.pdvSettings.updateWeighed.mutationOptions({
      onSuccess: () => {
        toast.success("Configuração da balança salva");
        queryClient.invalidateQueries({
          queryKey: orpc.pdvSettings.getWeighed.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Lookup imperativo (dentro do handler de scan), como `reverseGeocode`.
export function findProductByCode(code: string) {
  return client.products.findByCode({ code });
}
