"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCatalogPdv(storeId: string) {
  const { data, isPending } = useQuery({
    ...orpc.catalogPdv.list.queryOptions({ input: { storeId } }),
    enabled: !!storeId,
  });

  return {
    items: data?.items ?? [],
    missingStoreCostData: data?.missingStoreCostData ?? false,
    isLoading: isPending,
  };
}

export function useUpsertMediaTypePrice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mediaTypePrice.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Preço atualizado");
        queryClient.invalidateQueries({ queryKey: orpc.catalogPdv.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteMediaTypePrice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.mediaTypePrice.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Preço voltou a ser automático");
        queryClient.invalidateQueries({ queryKey: orpc.catalogPdv.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useTradePricingSettings() {
  const { data, isPending } = useQuery(
    orpc.tradePricingSettings.get.queryOptions({ input: {} }),
  );
  return { settings: data, isLoading: isPending };
}

export function useUpdateTradePricingSettings() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tradePricingSettings.update.mutationOptions({
      onSuccess: () => {
        toast.success("Configurações de precificação atualizadas");
        queryClient.invalidateQueries({
          queryKey: orpc.tradePricingSettings.get.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.catalogPdv.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRegionCostBenchmarks() {
  const { data, isPending } = useQuery(
    orpc.regionCostBenchmark.list.queryOptions({ input: {} }),
  );
  return { benchmarks: data?.items ?? [], isLoading: isPending };
}

function useInvalidateBenchmarks() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.regionCostBenchmark.list.key(),
    });
}

export function useCreateRegionCostBenchmark() {
  const invalidate = useInvalidateBenchmarks();
  return useMutation(
    orpc.regionCostBenchmark.create.mutationOptions({
      onSuccess: () => {
        toast.success("Benchmark criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateRegionCostBenchmark() {
  const invalidate = useInvalidateBenchmarks();
  return useMutation(
    orpc.regionCostBenchmark.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteRegionCostBenchmark() {
  const invalidate = useInvalidateBenchmarks();
  return useMutation(
    orpc.regionCostBenchmark.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Benchmark excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSelfBenchmark() {
  const { data, isPending } = useQuery(
    orpc.regionCostBenchmark.selfBenchmark.queryOptions({ input: {} }),
  );
  return { items: data?.items ?? [], isLoading: isPending };
}
