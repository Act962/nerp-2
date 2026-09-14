"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Mesmo ritmo do resto do KDS: o board, a TV e o app do garçom já batem de 5 em
// 5 segundos, e a cozinha não ganha nada com a estação sendo mais afoita.
const POLL_MS = 5000;

export function useTicketsParaImprimir(ativo: boolean) {
  return useQuery(
    orpc.kitchen.listPendingPrint.queryOptions({
      input: {},
      refetchInterval: ativo ? POLL_MS : false,
    }),
  );
}

export function useMarcarImpresso() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.kitchen.markPrinted.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.kitchen.listPendingPrint.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
