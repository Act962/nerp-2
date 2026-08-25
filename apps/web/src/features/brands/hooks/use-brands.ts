"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBrands(supplierId?: string) {
  const { data, isPending } = useQuery({
    ...orpc.brand.list.queryOptions({ input: { supplierId } }),
    enabled: supplierId === undefined || !!supplierId,
  });

  return { brands: data?.brands ?? [], isLoading: isPending };
}

export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.brand.create.mutationOptions({
      onSuccess: () => {
        toast.success("Marca criada com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.brand.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.brand.update.mutationOptions({
      onSuccess: () => {
        toast.success("Marca atualizada com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.brand.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.brand.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Marca excluída com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.brand.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
