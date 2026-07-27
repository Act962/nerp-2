"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { SalesGoalPeriodType } from "../lib/sales-goal-xlsx-parser";

// Recorte de venda: faturado (padrão) ou pipeline (todo pedido não cancelado).
export type SalesMode = "INVOICED" | "PIPELINE";

export function useSalesGoalRanking(
  periodType: SalesGoalPeriodType,
  salesMode: SalesMode = "INVOICED",
  periodStart?: string,
  includeInactiveBranches?: boolean,
) {
  return useQuery(
    orpc.ranking.list.queryOptions({
      input: { periodType, salesMode, periodStart, includeInactiveBranches },
      // vendido AUTO muda fora da tela (vendas concluídas no PDV) — polling
      // mantém Modo TV e sons reagindo sem interação
      refetchInterval: 30_000,
    }),
  );
}

// Versões públicas (página de TV deslogada): a org vem do slug na URL, não da
// sessão. Mesmo polling da tela interna pra manter o painel vivo sozinho.
export function usePublicSalesGoalRanking(
  orgSlug: string,
  periodType: SalesGoalPeriodType,
  salesMode: SalesMode = "INVOICED",
) {
  return useQuery(
    orpc.ranking.publicList.queryOptions({
      input: { orgSlug, periodType, salesMode },
      refetchInterval: 30_000,
    }),
  );
}

export function usePublicSalesGoalRankingSettings(orgSlug: string) {
  return useQuery(
    orpc.ranking.publicSettings.queryOptions({ input: { orgSlug } }),
  );
}

export function useSalesGoalPeriods(periodType?: SalesGoalPeriodType) {
  return useQuery(
    orpc.ranking.listPeriods.queryOptions({ input: { periodType } }),
  );
}

export function useImportSalesGoalRanking() {
  const qc = useQueryClient();
  return useMutation(
    orpc.ranking.import.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.ranking.key() }),
    }),
  );
}

export function useUpsertSalesGoalEntry() {
  const qc = useQueryClient();
  return useMutation(
    orpc.ranking.upsertEntry.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.ranking.key() }),
    }),
  );
}

export function useCreateSalesGoalEntry() {
  const qc = useQueryClient();
  return useMutation(
    orpc.ranking.createEntry.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.ranking.key() }),
    }),
  );
}

export function useDeleteSalesGoalEntry() {
  const qc = useQueryClient();
  return useMutation(
    orpc.ranking.deleteEntry.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.ranking.key() }),
    }),
  );
}

export function useUpdateSalesGoalBranch() {
  const qc = useQueryClient();
  return useMutation(
    orpc.ranking.updateBranch.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.ranking.key() }),
    }),
  );
}

export function useSalesGoalEvolution(periodType?: SalesGoalPeriodType) {
  return useQuery(
    orpc.ranking.evolution.queryOptions({ input: { periodType } }),
  );
}

export function useSalesGoalRankingSettings() {
  return useQuery(orpc.ranking.settings.get.queryOptions({ input: {} }));
}

export function useUpdateSalesGoalRankingSettings() {
  const qc = useQueryClient();
  return useMutation(
    orpc.ranking.settings.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.ranking.key() }),
    }),
  );
}
