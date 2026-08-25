import { buildSalesGoalRanking } from "@/app/router/ranking/_ranking-data";
import type { ResolveContext, WidgetValue } from "./_types";

// Mês corrente, mesmo default da tela de ranking — um widget de dashboard não
// tem seletor de período próprio na v1, é só um resumo do mês atual.
export async function getTeamRankingTop({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const period = await buildSalesGoalRanking(organizationId, {
    periodType: "MONTHLY",
  });
  const entries = (period?.branches ?? [])
    .flatMap((branch) => branch.entries)
    .sort((a, b) => (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1))
    .slice(0, 10);
  return {
    kind: "LIST",
    items: entries.map((entry, index) => ({
      id: entry.id,
      label: entry.sellerName,
      value: entry.achievedAmount ?? 0,
      unit: "currency" as const,
      meta:
        entry.percentAchieved !== null
          ? `${entry.percentAchieved.toFixed(0)}%`
          : undefined,
      rank: index + 1,
    })),
  };
}

export async function getTopTeamPercent({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const period = await buildSalesGoalRanking(organizationId, {
    periodType: "MONTHLY",
  });
  const branches = period?.branches ?? [];
  const best = branches.reduce<number>((max, branch) => {
    const percent =
      branch.goalTotal > 0
        ? (branch.achievedTotal / branch.goalTotal) * 100
        : 0;
    return Math.max(max, percent);
  }, 0);
  return { kind: "STAT", value: best, unit: "percent" };
}

export async function getOrgGoalVsAchieved({
  organizationId,
}: ResolveContext): Promise<WidgetValue> {
  const period = await buildSalesGoalRanking(organizationId, {
    periodType: "MONTHLY",
  });
  const goalTotal = period?.goalTotal ?? 0;
  const achievedTotal = period?.achievedTotal ?? 0;
  return {
    kind: "STAT",
    value: goalTotal > 0 ? (achievedTotal / goalTotal) * 100 : 0,
    unit: "percent",
  };
}
