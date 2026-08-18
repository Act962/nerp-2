"use client";

import { useState } from "react";
import type { SalesGoalPeriodType } from "@/features/ranking/lib/sales-goal-xlsx-parser";
import {
  type SalesMode,
  usePublicSalesGoalRanking,
  usePublicSalesGoalRankingSettings,
} from "../hooks/use-ranking";
import { SalesGoalRankingBoard } from "./sales-goal-ranking-board";

// Página pública/deslogada do ranking (painel de TV): a org vem do slug na URL.
// Só leitura — sem edição, sem dialogs de admin. O botão de tela cheia (Modo TV)
// e o polling vêm do próprio board. O seletor Faturado/Pipeline também vale aqui
// (o payload público expõe só valores de venda, sem custo/margem).
export function PublicRankingPage({ orgSlug }: { orgSlug: string }) {
  const [periodType, setPeriodType] = useState<SalesGoalPeriodType>("MONTHLY");
  const [salesMode, setSalesMode] = useState<SalesMode>("INVOICED");

  const query = usePublicSalesGoalRanking(orgSlug, periodType, salesMode);
  const settingsQuery = usePublicSalesGoalRankingSettings(orgSlug);

  return (
    <SalesGoalRankingBoard
      period={query.data}
      settings={settingsQuery.data}
      isLoading={query.isLoading}
      periodType={periodType}
      onPeriodTypeChange={setPeriodType}
      salesMode={salesMode}
      onSalesModeChange={setSalesMode}
      onRefresh={() => query.refetch()}
    />
  );
}
