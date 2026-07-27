"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useBilling() {
  return useQuery(orpc.billing.get.queryOptions({ input: {} }));
}

export function useSetBillingPlan() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.billing.setPlan.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.billing.get.key() });
      },
    }),
  );
}
