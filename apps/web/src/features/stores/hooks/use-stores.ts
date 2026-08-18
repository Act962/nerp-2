"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseStoresProps {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useStores({
  search,
  page = 1,
  pageSize = 10,
}: UseStoresProps = {}) {
  const { data, isPending } = useQuery(
    orpc.store.list.queryOptions({ input: { search, page, pageSize } }),
  );

  return {
    stores: data?.stores ?? [],
    totalCount: data?.totalCount ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalPages: data?.totalPages ?? 1,
    isLoading: isPending,
  };
}

export function useStoreOverview() {
  const { data, isPending } = useQuery(
    orpc.store.overview.queryOptions({ input: {} }),
  );
  return { overview: data, isLoading: isPending };
}

export function useStore(id: string) {
  const { data, isPending } = useQuery({
    ...orpc.store.getOne.queryOptions({ input: { id } }),
    enabled: !!id,
  });

  return { store: data?.store, isLoading: isPending };
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.store.create.mutationOptions({
      onSuccess: () => {
        toast.success("Loja criada com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.store.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

// Dedup do cadastro: geocoda o endereço e procura no diretório Tradegram uma
// loja já cadastrada no mesmo ponto. Só lê — não grava nada.
export function useMatchDirectoryStore() {
  return useMutation(orpc.store.matchDirectory.mutationOptions({}));
}

// Lojas da org que batem com o diretório por localização (nome divergente).
export function useMergeCandidates() {
  const { data, isPending } = useQuery(
    orpc.store.mergeCandidates.queryOptions({ input: {} }),
  );
  return { candidates: data?.candidates ?? [], isLoading: isPending };
}

// Alinha a loja ao ponto do diretório (adota nome + vincula). Não-destrutivo.
export function useMergeStoreWithDirectory() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.store.mergeWithDirectory.mutationOptions({
      onSuccess: () => {
        toast.success("Loja mesclada com o diretório");
        queryClient.invalidateQueries({
          queryKey: orpc.store.mergeCandidates.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.store.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateStore() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.store.update.mutationOptions({
      onSuccess: () => {
        toast.success("Loja atualizada com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.store.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.store.getOne.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteStore() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.store.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Loja excluída com sucesso");
        queryClient.invalidateQueries({ queryKey: orpc.store.list.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
