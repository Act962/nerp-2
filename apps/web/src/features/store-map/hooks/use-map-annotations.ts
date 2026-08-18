"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMapAnnotations(floorPlanId: string | undefined) {
  const { data } = useQuery({
    ...orpc.mapAnnotation.list.queryOptions({
      input: { floorPlanId: floorPlanId ?? "" },
    }),
    enabled: !!floorPlanId,
  });
  return data?.annotations ?? [];
}

export type MapAnnotation = ReturnType<typeof useMapAnnotations>[number];

function useInvalidateAnnotations() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.mapAnnotation.list.key() });
}

export function useCreateAnnotation() {
  const invalidate = useInvalidateAnnotations();
  return useMutation(
    orpc.mapAnnotation.create.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateAnnotation() {
  const invalidate = useInvalidateAnnotations();
  return useMutation(
    orpc.mapAnnotation.update.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteAnnotation() {
  const invalidate = useInvalidateAnnotations();
  return useMutation(
    orpc.mapAnnotation.delete.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
}
