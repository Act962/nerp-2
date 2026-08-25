"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type InterestStatus = "NOVO" | "EM_CONTATO" | "GANHO" | "ARQUIVADO";

export function useTradeInterests(filters?: {
  status?: InterestStatus;
  storeId?: string;
}) {
  return useQuery(
    orpc.tradeInterest.list.queryOptions({
      input: { status: filters?.status, storeId: filters?.storeId },
    }),
  );
}

export function useUpdateTradeInterestStatus() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tradeInterest.updateStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tradeInterest.list.key(),
        });
      },
    }),
  );
}
