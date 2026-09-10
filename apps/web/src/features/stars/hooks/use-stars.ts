"use client";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";

/**
 * O saldo é lido pela sidebar em toda página; 30 s de `staleTime` evitam uma
 * consulta por navegação. Quem gasta ★ (Astro, recarga) invalida na hora com
 * `useInvalidarSaldo`.
 */
export function useSaldo() {
  return useQuery(
    orpc.stars.balance.queryOptions({ input: {}, staleTime: 30_000 }),
  );
}

export function useInvalidarSaldo() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: orpc.stars.balance.key() }),
    [queryClient],
  );
}

export function useExtrato() {
  return useInfiniteQuery(
    orpc.stars.transactions.infiniteOptions({
      input: (cursor: string | undefined) => ({ cursor, limite: 30 }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
    }),
  );
}
