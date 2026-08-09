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

export function useCashRegisters(includeInactive?: boolean) {
  const query = useQuery(
    orpc.cashRegister.list.queryOptions({ input: { includeInactive } }),
  );
  return {
    registers: query.data?.registers ?? [],
    isLoading: query.isPending,
  };
}

function useInvalidateRegisters() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.cashRegister.list.key() });
}

export function useCreateRegister() {
  const invalidate = useInvalidateRegisters();
  return useMutation(
    orpc.cashRegister.create.mutationOptions({
      onSuccess: () => {
        toast.success("Caixa criado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useUpdateRegister() {
  const invalidate = useInvalidateRegisters();
  return useMutation(
    orpc.cashRegister.update.mutationOptions({
      onSuccess: () => {
        toast.success("Caixa atualizado");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteRegister() {
  const invalidate = useInvalidateRegisters();
  return useMutation(
    orpc.cashRegister.delete.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.deactivated ? "Caixa desativado" : "Caixa excluído");
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
