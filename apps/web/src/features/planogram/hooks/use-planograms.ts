"use client";

import { orpc } from "@/lib/orpc";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export function usePlanograms() {
  const { data, isPending } = useQuery(
    orpc.planogram.list.queryOptions({ input: {} }),
  );
  return { planograms: data?.planograms ?? [], isLoading: isPending };
}

export function usePlanogramFull(id: string) {
  const { data, isPending } = useQuery({
    ...orpc.planogram.getFull.queryOptions({ input: { id } }),
    enabled: !!id,
    // O editor é dono do estado depois de hidratar: um refetch em background
    // sobrescreveria edições em andamento.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  return { scene: data, isLoading: isPending };
}

function useInvalidatePlanograms() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.planogram.list.key() });
  };
}

export function useCreatePlanogram() {
  const invalidate = useInvalidatePlanograms();
  return useMutation(
    orpc.planogram.create.mutationOptions({
      onSuccess: () => {
        toast.success("Planograma criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePlanogram() {
  const invalidate = useInvalidatePlanograms();
  return useMutation(
    orpc.planogram.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeletePlanogram() {
  const invalidate = useInvalidatePlanograms();
  return useMutation(
    orpc.planogram.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Planograma excluído");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCreatePlanogramVersion() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.planogram.createVersion.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Versão ${result.version} salva no histórico`);
        queryClient.invalidateQueries({
          queryKey: orpc.planogram.listVersions.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.planogram.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function usePlanogramVersions(planogramId: string) {
  const { data, isPending } = useQuery({
    ...orpc.planogram.listVersions.queryOptions({ input: { planogramId } }),
    enabled: !!planogramId,
  });
  return { versions: data?.versions ?? [], isLoading: isPending };
}

/**
 * Busca de produto no seletor. Paginada por cursor e SEM contagem total — em
 * 400 mil SKUs, contar a cada tecla é justamente o que trava.
 */
export function useProductSearch(params: {
  q: string;
  categoryId?: string;
  brandId?: string;
  onlyWithDimensions?: boolean;
}) {
  const query = useInfiniteQuery({
    ...orpc.planogram.searchProducts.infiniteOptions({
      input: (cursor: string | undefined) => ({
        q: params.q || undefined,
        categoryId: params.categoryId,
        brandId: params.brandId,
        onlyWithDimensions: params.onlyWithDimensions,
        cursor,
      }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined,
    }),
    placeholderData: keepPreviousData,
  });

  return {
    products: query.data?.pages.flatMap((page) => page.products) ?? [],
    isLoading: query.isPending,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
