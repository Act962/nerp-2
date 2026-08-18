"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSpaceNegotiations(mapObjectId: string | null) {
  const { data, isPending } = useQuery({
    ...orpc.spaceNegotiation.list.queryOptions({
      input: { mapObjectId: mapObjectId ?? "" },
    }),
    enabled: !!mapObjectId,
  });

  return { negotiations: data ?? [], isLoading: isPending };
}

export type ExpiryUnit = "days" | "months" | "years";

export function useExpiringNegotiations(
  unit: ExpiryUnit,
  amount: number,
  enabled = true,
) {
  return useQuery({
    ...orpc.spaceNegotiation.listExpiring.queryOptions({
      input: { unit, amount },
    }),
    enabled,
  });
}

function useInvalidateNegotiations() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.spaceNegotiation.list.key(),
    });
}

export function useCreateSpaceNegotiation() {
  const invalidate = useInvalidateNegotiations();

  return useMutation(
    orpc.spaceNegotiation.create.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateSpaceNegotiation() {
  const invalidate = useInvalidateNegotiations();

  return useMutation(
    orpc.spaceNegotiation.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteSpaceNegotiation() {
  const invalidate = useInvalidateNegotiations();

  return useMutation(
    orpc.spaceNegotiation.delete.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (error) => toast.error(error.message),
    }),
  );
}
