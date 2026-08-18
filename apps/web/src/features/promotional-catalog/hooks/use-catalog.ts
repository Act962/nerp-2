"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CatalogConfig } from "../types";

export function usePromotionalCatalogs() {
  return useQuery(orpc.promotionalCatalog.list.queryOptions({ input: {} }));
}

export function usePromotionalCatalog(id: string) {
  return useQuery(orpc.promotionalCatalog.get.queryOptions({ input: { id } }));
}

export function useCreateCatalog() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    orpc.promotionalCatalog.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        router.push(`/catalogo-promocional/${data.id}`);
      },
      onError: () => {
        toast.error("Erro ao criar catálogo");
      },
    }),
  );
}

export function useUpdateCatalog() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.promotionalCatalog.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.get.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        // Invalida em background sem resetar a UI — o filtro/sort
        // já é feito no cliente via useMemo
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
      },
    }),
  );
}

export function useDeleteCatalog() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.promotionalCatalog.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        toast.success("Catálogo excluído");
      },
      onError: () => {
        toast.error("Erro ao excluir catálogo");
      },
    }),
  );
}

export function useDuplicateCatalog() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const createMutation = useMutation(
    orpc.promotionalCatalog.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.list.key(),
        });
        router.push(`/catalogo-promocional/${data.id}`);
      },
      onError: () => {
        toast.error("Erro ao duplicar catálogo");
      },
    }),
  );
  const updateMutation = useMutation(
    orpc.promotionalCatalog.update.mutationOptions({}),
  );

  const duplicate = async (id: string, name: string, config: CatalogConfig) => {
    const created = await createMutation.mutateAsync({ name: `Cópia de ${name}` });
    await updateMutation.mutateAsync({ id: created.id, config: config as Record<string, unknown> });
  };

  return {
    duplicate,
    isPending: createMutation.isPending || updateMutation.isPending,
  };
}

export function useUpdateProductPrice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.promotionalCatalog.updateProductPrice.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.promotionalCatalog.listProducts.key(),
        });
      },
      onError: () => {
        toast.error("Erro ao salvar preço promocional");
      },
    }),
  );
}

// excludedIds e sortBy são intencionalmente omitidos do input da query:
// o filtro/ordenação fica no cliente via useMemo para evitar refetch a cada
// mudança e garantir UI otimista sem reset.
export function usePromotionalProducts(input: {
  manuallyAddedIds?: string[];
  categoryFilter?: string[];
  name?: string;
}) {
  return useQuery(
    orpc.promotionalCatalog.listProducts.queryOptions({ input }),
  );
}
