"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

// Dicionário do Oracle é estático na prática (contorno de tabela não muda) e o
// servidor já cacheia por 1h — `staleTime` alto evita refetch a cada abertura
// do painel de personalização.
const DICTIONARY_STALE_MS = 30 * 60_000;

export function useOracleTables(enabled: boolean) {
  return useQuery(
    orpc.oracleExplorer.listTables.queryOptions({
      input: {},
      enabled,
      staleTime: DICTIONARY_STALE_MS,
    }),
  );
}

export function useOracleColumns(table: string | null) {
  return useQuery(
    orpc.oracleExplorer.listColumns.queryOptions({
      input: { table: table ?? "" },
      enabled: Boolean(table),
      staleTime: DICTIONARY_STALE_MS,
    }),
  );
}

export function useOracleDimensionValues(
  quickFilter: string | null,
  search: string,
) {
  return useQuery(
    orpc.oracleExplorer.listDimensionValues.queryOptions({
      input: { quickFilter: quickFilter ?? "", search: search || undefined },
      enabled: Boolean(quickFilter),
      staleTime: DICTIONARY_STALE_MS,
    }),
  );
}

// Sem toast: o resultado (inclusive a falha) é mostrado na própria caixa de
// teste, igual ao "Testar conexão" das Integrações.
export function usePreviewOracleQuery() {
  return useMutation(orpc.oracleExplorer.preview.mutationOptions({}));
}

export function useOracleQueryTemplates(enabled: boolean) {
  return useQuery(
    orpc.oracleExplorer.templates.list.queryOptions({ input: {}, enabled }),
  );
}

export function useSaveOracleQueryTemplate() {
  const qc = useQueryClient();
  return useMutation(
    orpc.oracleExplorer.templates.save.mutationOptions({
      onSuccess: () => {
        toast.success("Modelo salvo");
        qc.invalidateQueries({
          queryKey: orpc.oracleExplorer.templates.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useDeleteOracleQueryTemplate() {
  const qc = useQueryClient();
  return useMutation(
    orpc.oracleExplorer.templates.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Modelo removido");
        qc.invalidateQueries({
          queryKey: orpc.oracleExplorer.templates.list.key(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}
