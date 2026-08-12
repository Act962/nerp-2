"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useListPriceLists() {
  return useQuery(orpc.precos.list.queryOptions({ input: {} }));
}

export function useListProductPrices(input: {
  priceListId?: string;
  productId?: string;
}) {
  return useQuery(
    orpc.precos.listProductPrices.queryOptions({
      input,
      enabled: Boolean(input.priceListId || input.productId),
    }),
  );
}

export function useCreatePriceList() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.precos.create.mutationOptions({
      onSuccess: () => {
        toast.success("Tabela criada");
        queryClient.invalidateQueries({ queryKey: orpc.precos.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdatePriceList() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.precos.update.mutationOptions({
      onSuccess: () => {
        toast.success("Tabela atualizada");
        queryClient.invalidateQueries({ queryKey: orpc.precos.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeletePriceList() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.precos.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Tabela excluída");
        queryClient.invalidateQueries({ queryKey: orpc.precos.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSetProductPrice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.precos.setProductPrice.mutationOptions({
      onSuccess: () => {
        toast.success("Faixa salva");
        queryClient.invalidateQueries({
          queryKey: orpc.precos.listProductPrices.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.precos.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteProductPrice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.precos.deleteProductPrice.mutationOptions({
      onSuccess: () => {
        toast.success("Faixa removida");
        queryClient.invalidateQueries({
          queryKey: orpc.precos.listProductPrices.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.precos.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
