"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

export function useCategoriasDaVitrine() {
  return useQuery(orpc.catalogSettings.showcaseCategories.queryOptions());
}

/**
 * Ícone e imagem salvam na hora, fora do botão "Salvar" do catálogo: são
 * dados da categoria, não das configurações — e segurar a troca até o
 * Salvar deixaria a pessoa achar que o ícone escolhido já estava no ar.
 */
export function useAtualizarCategoriaDaVitrine() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.catalogSettings.updateCategoryAppearance.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.catalogSettings.showcaseCategories.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCatalogosDeOferta() {
  return useQuery(orpc.catalogSettings.offerCatalogs.queryOptions());
}
