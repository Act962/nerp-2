"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { SalesGoalPodium } from "@/features/ranking/components/sales-goal-podium";
import { SalesGoalRankRow } from "@/features/ranking/components/sales-goal-rank-row";
import { SalesGoalTeamsCarousel } from "@/features/ranking/components/sales-goal-teams-carousel";
import {
  useSalesGoalRanking,
  useSalesGoalRankingSettings,
} from "@/features/ranking/hooks/use-ranking";
import { SALES_GOAL_THEME_STYLES } from "@/features/ranking/lib/sales-goal-theme";

// Mesmo identificador de "todas as equipes" da tela /ranking.
const ALL_BRANCHES = "__all__";
/** Mesma cadência do board: 5 min por time quando a rotação está ligada. */
const AUTO_ADVANCE_SECONDS = 300;

// Mesma visualização da tela /ranking (pódio + linhas), só que compacta e
// sempre somente-leitura — reaproveita os componentes reais em vez de
// reconstruir o visual à parte, então qualquer ajuste no ranking original se
// reflete aqui sozinho.
export function RankingWidget() {
  const { data: period, isLoading } = useSalesGoalRanking("MONTHLY");
  const { data: settings } = useSalesGoalRankingSettings();
  const theme = SALES_GOAL_THEME_STYLES[settings?.theme ?? "GAMING"];
  const [selectedBranch, setSelectedBranch] = useState<string>(ALL_BRANCHES);

  const teams = useMemo(() => {
    const list = [{ id: ALL_BRANCHES, name: "Todas" }];
    for (const branch of period?.branches ?? []) {
      list.push({ id: branch.id, name: branch.name });
    }
    return list;
  }, [period]);

  const entries = useMemo(() => {
    const branches =
      selectedBranch === ALL_BRANCHES
        ? (period?.branches ?? [])
        : (period?.branches ?? []).filter(
            (branch) => branch.id === selectedBranch,
          );
    return branches
      .flatMap((branch) => branch.entries)
      .sort((a, b) => (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1));
  }, [period, selectedBranch]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if ((period?.branches ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma meta cadastrada ainda.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {/* SalesGoalPodium tem altura própria fixa (420-560px, ver
        sales-goal-podium.tsx) — não encolhe pra caber num wrapper menor.
        Deixa no tamanho natural aqui dentro e quem rola é o container de
        fora; espremer numa div menor fazia o pódio vazar por cima da lista
        abaixo. */}
      <SalesGoalPodium
        entries={entries}
        showScore
        showPercent
        showSoldValue
        podiumGradient={theme.podiumGradient}
        accent={theme.accent}
      />
      {/* SalesGoalRankRow não tem fundo próprio — na tela /ranking original
        (sales-goal-ranking-board.tsx) ele fica dentro de um painel com
        `background: theme.podiumGradient`, e é esse fundo que dá contraste
        pro texto branco de `textOnDark`. Sem essa mesma cor de fundo aqui,
        tema escuro (textOnDark) rendia texto branco sobre o card claro do
        widget — nome do vendedor sumia. */}
      <div
        className="flex flex-col gap-1.5 rounded-xl p-2"
        style={{ background: theme.podiumGradient }}
      >
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhum vendedor nesta equipe.
          </p>
        ) : (
          entries
            .slice(0, 5)
            .map((entry, index) => (
              <SalesGoalRankRow
                key={entry.id}
                entry={entry}
                position={index + 1}
                showScore
                showPercent
                accent={theme.accent}
                textOnDark={theme.textOnDark}
              />
            ))
        )}

        {/* Mesmo carrossel da tela /ranking: botões de time + rotação
          automática com play/pause. Fica DENTRO do painel escuro porque ele
          usa texto claro, igual às linhas acima. */}
        <SalesGoalTeamsCarousel
          teams={teams}
          selectedId={selectedBranch}
          onSelect={setSelectedBranch}
          autoAdvanceSeconds={AUTO_ADVANCE_SECONDS}
          accent={theme.accent}
          defaultPlaying
        />
      </div>
    </div>
  );
}
