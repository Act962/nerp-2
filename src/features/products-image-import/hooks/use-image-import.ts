"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Query 1x: dado uma lista de SKUs (extraídos dos nomes de arquivo), casa com
// produtos da org e devolve pra tela decidir o que subir. NÃO usa useQuery
// porque o input muda a cada seleção nova de pasta — mutation é mais direto.
export function useMatchBySku() {
  return useMutation(orpc.products.matchBySku.mutationOptions({}));
}

// Busca no Winthor (Oracle) — disparada por botão/debounce, não useQuery: é
// consulta ao vivo contra o ERP de produção do cliente, então o componente
// decide quando vale a pena gastar uma chamada (não em toda tecla digitada).
export function useSearchOracleImages() {
  return useMutation(orpc.products.searchOracleImages.mutationOptions({}));
}

// Após o upload da imagem pro R2, o client chama esta mutation por produto
// para vincular a key ao registro. Invalida a listagem de produtos ao fim.
export function useSetProductImages() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.products.setImages.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.products.list.key(),
        });
      },
    }),
  );
}
