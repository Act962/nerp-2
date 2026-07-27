"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useDistributors(search?: string) {
  return useQuery(
    orpc.distributor.list.queryOptions({ input: search ? { search } : {} }),
  );
}

export function useDistributorRelations(distributorId: string) {
  return useQuery({
    ...orpc.distributor.getRelations.queryOptions({ input: { distributorId } }),
    enabled: !!distributorId,
  });
}

function useInvalidateDistributors() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.distributor.list.key() });
}

export function useCreateDistributor() {
  const invalidate = useInvalidateDistributors();
  return useMutation(
    orpc.distributor.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateDistributor() {
  const invalidate = useInvalidateDistributors();
  return useMutation(
    orpc.distributor.update.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteDistributor() {
  const invalidate = useInvalidateDistributors();
  return useMutation(
    orpc.distributor.delete.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useSetDistributorRelations() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.distributor.setRelations.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.distributor.getRelations.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.distributor.list.key(),
        });
      },
    }),
  );
}
