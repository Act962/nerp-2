"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useFunnels(incluirArquivados = false) {
  return useQuery(
    orpc.crm.funnel.list.queryOptions({ input: { incluirArquivados } }),
  );
}

export function useCreateFunnel() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.crm.funnel.create.mutationOptions({
      onSuccess: () => {
        toast.success("Funil criado");
        queryClient.invalidateQueries({ queryKey: orpc.crm.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
