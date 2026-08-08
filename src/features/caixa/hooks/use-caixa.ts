"use client";

import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function useCaixaCurrent() {
  const query = useQuery(orpc.caixa.current.queryOptions({ input: {} }));
  return { session: query.data?.session ?? null, isLoading: query.isPending };
}

function useInvalidateCaixa() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.caixa.current.key() });
    queryClient.invalidateQueries({ queryKey: orpc.caixa.list.key() });
  };
}

export function useAbrirCaixa() {
  const invalidate = useInvalidateCaixa();
  return useMutation(
    orpc.caixa.abrir.mutationOptions({
      onSuccess: () => {
        toast.success("Caixa aberto");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useFecharCaixa() {
  const invalidate = useInvalidateCaixa();
  return useMutation(
    orpc.caixa.fechar.mutationOptions({
      onSuccess: () => {
        toast.success("Caixa fechado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSangria() {
  const invalidate = useInvalidateCaixa();
  return useMutation(
    orpc.caixa.sangria.mutationOptions({
      onSuccess: () => {
        toast.success("Sangria registrada");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useSuprimento() {
  const invalidate = useInvalidateCaixa();
  return useMutation(
    orpc.caixa.suprimento.mutationOptions({
      onSuccess: () => {
        toast.success("Suprimento registrado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useCaixaSessions() {
  const query = useInfiniteQuery({
    ...orpc.caixa.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ cursor, limit: 20 }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined,
    }),
  });
  return {
    sessions: query.data?.pages.flatMap((page) => page.sessions) ?? [],
    isLoading: query.isPending,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
