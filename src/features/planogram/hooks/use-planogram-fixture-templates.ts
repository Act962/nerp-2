"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function usePlanogramFixtureTemplates() {
  const { data, isPending } = useQuery(
    orpc.planogram.listFixtureTemplates.queryOptions({ input: {} }),
  );
  return { templates: data ?? [], isLoading: isPending };
}

export function useSaveFixtureTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.planogram.saveFixtureTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["planogram"] });
      },
    }),
  );
}

export function useDeleteFixtureTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.planogram.deleteFixtureTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["planogram"] });
      },
    }),
  );
}
