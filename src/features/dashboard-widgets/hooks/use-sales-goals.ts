"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useSalesGoals(year?: number) {
  return useQuery(
    orpc.dashboardWidgets.salesGoals.list.queryOptions({ input: { year } }),
  );
}

function useInvalidateSalesGoals() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.dashboardWidgets.key() });
  };
}

export function useCreateSalesGoal() {
  const invalidate = useInvalidateSalesGoals();
  return useMutation(
    orpc.dashboardWidgets.salesGoals.create.mutationOptions({
      onSuccess: () => {
        toast.success("Meta salva!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateSalesGoal() {
  const invalidate = useInvalidateSalesGoals();
  return useMutation(
    orpc.dashboardWidgets.salesGoals.update.mutationOptions({
      onSuccess: () => {
        toast.success("Meta atualizada!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteSalesGoal() {
  const invalidate = useInvalidateSalesGoals();
  return useMutation(
    orpc.dashboardWidgets.salesGoals.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Meta removida!");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
