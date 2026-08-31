"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useSaldo() {
  return useQuery(orpc.stars.balance.queryOptions({ input: {} }));
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
