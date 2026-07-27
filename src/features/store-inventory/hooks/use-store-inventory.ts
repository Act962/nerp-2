"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useBatches(storeId: string) {
  return useQuery(
    orpc.storeInventory.listBatches.queryOptions({ input: { storeId } }),
  );
}

export function useRuptureTasks(storeId: string) {
  return useQuery(
    orpc.storeInventory.ruptureTasks.queryOptions({ input: { storeId } }),
  );
}

function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.storeInventory.listBatches.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.storeInventory.ruptureTasks.key(),
    });
  };
}

export function useUpsertBatch() {
  const invalidate = useInvalidateInventory();
  return useMutation(
    orpc.storeInventory.upsertBatch.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useSetClearance() {
  const invalidate = useInvalidateInventory();
  return useMutation(
    orpc.storeInventory.setClearance.mutationOptions({ onSuccess: invalidate }),
  );
}
