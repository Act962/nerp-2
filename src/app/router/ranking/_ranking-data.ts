import prisma from "@/lib/db";
import { buildAchievedLookup } from "./_sales-aggregation";
import { ALL_PERIOD_TYPES, type SalesMode } from "./_schemas";
import { buildVirtualPeriodFromErp } from "./_virtual-period";

type SalesGoalPeriodType = (typeof ALL_PERIOD_TYPES)[number];

interface BuildRankingInput {
  periodType: SalesGoalPeriodType;
  periodStart?: string;
  includeInactiveBranches?: boolean;
  salesMode?: SalesMode;
}

// Fonte única do ranking: usada pela rota autenticada (ranking.list) e pela
// pública (ranking.publicList). Percentual atingido e valor faltante são sempre
// derivados aqui, nunca persistidos. Entry vinculada a um Member tem o vendido
// calculado das vendas (achievedSource AUTO); sem vínculo — ou com override
// manual (achievedIsManual) — vale o valor digitado (MANUAL).
export async function buildSalesGoalRanking(
  organizationId: string,
  input: BuildRankingInput,
) {
  const salesMode: SalesMode = input.salesMode ?? "INVOICED";

  // Origem padrão do ranking: enquanto houver uma conexão de ERP externo ATIVA,
  // o board mostra os dados do ERP (todos os vendedores do Winthor, ordenados
  // por vendido), MESMO que já exista planilha importada. Pausar ou remover a
  // conexão devolve o comando à planilha. Sem fatos na janela pedida (ex.: mês
  // fora da cobertura do espelho), cai para a planilha em vez de um board vazio.
  const connection = await prisma.erpConnection.findUnique({
    where: { organizationId },
    select: { kind: true, status: true },
  });
  const erpActive =
    connection !== null &&
    connection.kind !== "NATIVE" &&
    connection.status !== "PAUSED";

  if (erpActive) {
    const erpPeriod = await buildVirtualPeriodFromErp(
      organizationId,
      input.periodType,
      undefined,
      salesMode,
    );
    if (erpPeriod) return erpPeriod;
  }

  const period = await prisma.salesGoalPeriod.findFirst({
    where: {
      organizationId,
      periodType: input.periodType,
      ...(input.periodStart
        ? { periodStart: new Date(input.periodStart) }
        : {}),
    },
    orderBy: { periodStart: "desc" },
    include: {
      branches: {
        where: input.includeInactiveBranches ? {} : { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { entries: true },
      },
    },
  });

  // Sem planilha cadastrada: se o ERP ativo não tinha fatos na janela, honra o
  // board vazio; senão mantém o caminho antigo (deriva do espelho, que já
  // devolve null quando não há ERP externo).
  if (!period) {
    return erpActive
      ? null
      : buildVirtualPeriodFromErp(
          organizationId,
          input.periodType,
          undefined,
          salesMode,
        );
  }

  const linkedMemberIds = [
    ...new Set(
      period.branches
        .flatMap((branch) => branch.entries)
        .map((entry) => entry.memberId)
        .filter((memberId): memberId is string => memberId !== null),
    ),
  ];
  const lookup = await buildAchievedLookup(
    organizationId,
    period.periodStart,
    period.periodEnd,
    linkedMemberIds,
    salesMode,
    // Conexão já resolvida acima — evita o `findUnique` repetido lá dentro.
    connection ? { kind: connection.kind } : null,
  );

  const pace = computePeriodPace(period.periodStart, period.periodEnd);

  const branches = period.branches.map((branch) => {
    const entries = branch.entries
      .map((entry) => {
        const goalAmount = Number(entry.goalAmount);
        const autoAchieved = entry.achievedIsManual
          ? null
          : lookup.achievedFor(entry);
        const achievedAmount =
          autoAchieved !== null
            ? autoAchieved
            : entry.achievedAmount !== null
              ? Number(entry.achievedAmount)
              : null;
        const percentAchieved =
          achievedAmount !== null && goalAmount > 0
            ? (achievedAmount / goalAmount) * 100
            : null;
        const remainingAmount =
          achievedAmount !== null
            ? Math.max(goalAmount - achievedAmount, 0)
            : goalAmount;

        // Projeção de fechamento: mantido o ritmo até aqui, onde termina o mês.
        // É o número que antecipa o estouro de meta enquanto ainda dá pra agir.
        const projectedAmount =
          achievedAmount !== null && pace.elapsedRatio > 0
            ? achievedAmount / pace.elapsedRatio
            : null;

        return {
          id: entry.id,
          externalCode: entry.externalCode,
          goalName: entry.goalName,
          sellerName: entry.sellerName,
          entryKind: entry.entryKind,
          goalAmount,
          achievedAmount,
          percentAchieved,
          remainingAmount,
          memberId: entry.memberId,
          photoUrl: entry.photoUrl,
          achievedSource:
            autoAchieved !== null ? ("AUTO" as const) : ("MANUAL" as const),
          // Só existe com ERP externo — venda nativa não tem custo nem pedidos.
          metrics: lookup.metricsFor(entry),
          projectedAmount,
          projectedPercent:
            projectedAmount !== null && goalAmount > 0
              ? (projectedAmount / goalAmount) * 100
              : null,
        };
      })
      // Sem meta cadastrada o percentual é null para todo mundo; o desempate
      // por valor vendido mantém o ranking legível nesse caso.
      .sort(
        (a, b) =>
          (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1) ||
          (b.achievedAmount ?? 0) - (a.achievedAmount ?? 0),
      );

    const goalTotal = entries.reduce(
      (total, entry) => total + entry.goalAmount,
      0,
    );
    const achievedTotal = entries.reduce(
      (total, entry) => total + (entry.achievedAmount ?? 0),
      0,
    );

    return {
      id: branch.id,
      name: branch.name,
      isActive: branch.isActive,
      goalTotal,
      achievedTotal,
      entries,
    };
  });

  const goalTotal = branches.reduce(
    (total, branch) => total + branch.goalTotal,
    0,
  );
  const achievedTotal = branches.reduce(
    (total, branch) => total + branch.achievedTotal,
    0,
  );

  const allEntries = branches.flatMap((branch) => branch.entries);
  const revenueTotal = allEntries.reduce(
    (total, entry) => total + (entry.metrics?.revenue ?? 0),
    0,
  );
  const costTotal = allEntries.reduce(
    (total, entry) => total + (entry.metrics?.cost ?? 0),
    0,
  );
  const ordersTotal = allEntries.reduce(
    (total, entry) => total + (entry.metrics?.orders ?? 0),
    0,
  );
  const projectedTotal =
    pace.elapsedRatio > 0 ? achievedTotal / pace.elapsedRatio : null;

  return {
    id: period.id,
    periodType: period.periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    label: period.label,
    goalTotal,
    achievedTotal,
    branches,
    // Origem do vendido: "ERP" = espelho do ERP externo, "NATIVE" = vendas do
    // NERP. A UI usa para dizer de onde vem o número em vez de deixar no ar.
    achievedSourceKind: lookup.source,
    pace,
    projectedTotal,
    projectedPercent:
      projectedTotal !== null && goalTotal > 0
        ? (projectedTotal / goalTotal) * 100
        : null,
    // Margem só existe com ERP externo; sem custo, fica null em vez de zero.
    marginTotal: revenueTotal > 0 ? revenueTotal - costTotal : null,
    marginPercent:
      revenueTotal > 0
        ? ((revenueTotal - costTotal) / revenueTotal) * 100
        : null,
    averageTicket: ordersTotal > 0 ? revenueTotal / ordersTotal : null,
    ordersTotal,
    // Recorte ativo + total do outro recorte, para o board oferecer o toggle e
    // mostrar o modo não-selecionado como indicador secundário.
    salesMode: lookup.salesMode,
    invoicedTotal: lookup.periodTotals().invoiced,
    pipelineTotal: lookup.periodTotals().pipeline,
  };
}

export interface PeriodPace {
  totalDays: number;
  elapsedDays: number;
  /** Fração do período já decorrida, entre 0 e 1. */
  elapsedRatio: number;
  isClosed: boolean;
}

// `periodEnd` chega como 00:00 do último dia (convenção do parser da planilha),
// então o último dia conta inteiro.
function computePeriodPace(periodStart: Date, periodEnd: Date): PeriodPace {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(
    Math.round((periodEnd.getTime() - periodStart.getTime()) / ONE_DAY) + 1,
    1,
  );
  const elapsed =
    Math.floor((Date.now() - periodStart.getTime()) / ONE_DAY) + 1;
  const elapsedDays = Math.min(Math.max(elapsed, 0), totalDays);

  return {
    totalDays,
    elapsedDays,
    elapsedRatio: elapsedDays / totalDays,
    isClosed: elapsedDays >= totalDays,
  };
}

// Sem registro ainda? Devolve os defaults (nada persistido) pra UI já
// renderizar o formulário preenchido — evita side-effect de criar linha
// num GET.
export async function resolveSalesGoalRankingSettings(organizationId: string) {
  const settings = await prisma.salesGoalRankingSettings.findUnique({
    where: { organizationId },
  });

  if (!settings) {
    return {
      id: null,
      displayName: "Ranking de Equipes",
      theme: "GAMING" as const,
      activePeriodTypes: [...ALL_PERIOD_TYPES],
      soundEnabled: true,
      scoreSoundUrl: null,
      overtakeSoundUrl: null,
      victorySoundUrl: null,
      soundVolume: 0.6,
      prizes: [] as { position: number; label: string; imageUrl?: string }[],
    };
  }

  return {
    id: settings.id,
    displayName: settings.displayName,
    theme: settings.theme,
    activePeriodTypes: settings.activePeriodTypes,
    soundEnabled: settings.soundEnabled,
    scoreSoundUrl: settings.scoreSoundUrl,
    overtakeSoundUrl: settings.overtakeSoundUrl,
    victorySoundUrl: settings.victorySoundUrl,
    soundVolume: settings.soundVolume,
    prizes: settings.prizes as {
      position: number;
      label: string;
      imageUrl?: string;
    }[],
  };
}
