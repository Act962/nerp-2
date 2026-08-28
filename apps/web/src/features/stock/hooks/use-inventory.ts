"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useInventoryCounts(status?: "OPEN" | "APPLIED" | "CANCELLED") {
  return useQuery(
    orpc.inventory.list.queryOptions({ input: status ? { status } : {} }),
  );
}

export function useInventoryCount(id: string | undefined) {
  return useQuery(
    orpc.inventory.get.queryOptions({
      input: { id: id ?? "" },
      enabled: Boolean(id),
    }),
  );
}

function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.inventory.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.inventory.get.key() });
  };
}

export function useCreateInventoryCount() {
  const invalidate = useInvalidateInventory();
  return useMutation(
    orpc.inventory.create.mutationOptions({
      onSuccess: () => {
        toast.success("Contagem aberta");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCountInventoryItem() {
  const invalidate = useInvalidateInventory();
  return useMutation(
    orpc.inventory.countItem.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useApplyInventoryCount() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.inventory.apply.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.adjusted === 0
            ? "Contagem encerrada — nenhuma divergência"
            : `${result.adjusted} produto(s) ajustado(s)`,
        );
        queryClient.invalidateQueries({ queryKey: orpc.inventory.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.inventory.get.key() });
        queryClient.invalidateQueries({ queryKey: orpc.stocks.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.products.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCancelInventoryCount() {
  const invalidate = useInvalidateInventory();
  return useMutation(
    orpc.inventory.cancel.mutationOptions({
      onSuccess: () => {
        toast.success("Contagem descartada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
