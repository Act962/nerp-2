"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useFloorPlans(storeId: string) {
  const { data, isPending } = useQuery({
    ...orpc.floorPlan.list.queryOptions({ input: { storeId } }),
    enabled: !!storeId,
  });

  return { floorPlans: data?.floorPlans ?? [], isLoading: isPending };
}

export function useCreateFloorPlan() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.floorPlan.create.mutationOptions({
      onSuccess: () => {
        toast.success("Mapa criado com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.floorPlan.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteFloorPlan() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.floorPlan.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Mapa excluído com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.floorPlan.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateFloorPlan() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.floorPlan.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.floorPlan.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
