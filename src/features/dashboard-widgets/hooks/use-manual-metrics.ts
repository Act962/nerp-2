"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useManualMetrics() {
  return useQuery(
    orpc.dashboardWidgets.manualMetrics.list.queryOptions({ input: {} }),
  );
}

function useInvalidateManualMetrics() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.dashboardWidgets.key() });
  };
}

export function useCreateManualMetric() {
  const invalidate = useInvalidateManualMetrics();
  return useMutation(
    orpc.dashboardWidgets.manualMetrics.create.mutationOptions({
      onSuccess: () => {
        toast.success("Métrica criada!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateManualMetric() {
  const invalidate = useInvalidateManualMetrics();
  return useMutation(
    orpc.dashboardWidgets.manualMetrics.update.mutationOptions({
      onSuccess: () => {
        toast.success("Métrica atualizada!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteManualMetric() {
  const invalidate = useInvalidateManualMetrics();
  return useMutation(
    orpc.dashboardWidgets.manualMetrics.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Métrica removida!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
