"use client";

import { Filter, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { normalizeCollaboratorName } from "@/features/ranking/lib/collaborator-name-match";
import { compareRankEntries } from "@/features/ranking/lib/sales-goal-rank-order";
import { playSalesGoalSound } from "@/features/ranking/lib/sales-goal-sound-presets";
import { SALES_GOAL_THEME_STYLES } from "@/features/ranking/lib/sales-goal-theme";
import type { SalesGoalPeriodType } from "@/features/ranking/lib/sales-goal-xlsx-parser";
import { cn } from "@/lib/utils";
import { SalesGoalPerformanceStrip } from "./sales-goal-performance-strip";
import {
  formatBrl,
  SalesGoalPodium,
  type SalesGoalRankEntry,
} from "./sales-goal-podium";
import { SalesGoalRankRow } from "./sales-goal-rank-row";
import { SalesGoalSideRail } from "./sales-goal-side-rail";
import { SalesGoalTeamHeader } from "./sales-goal-team-header";
import { SalesGoalTeamsCarousel } from "./sales-goal-teams-carousel";

const ALL_PERIOD_TABS: { key: SalesGoalPeriodType; label: string }[] = [
  { key: "DAILY", label: "Diário" },
  { key: "WEEKLY", label: "Semanal" },
  { key: "MONTHLY", label: "Mensal" },
  { key: "BIMONTHLY", label: "Bimestral" },
  { key: "QUARTERLY", label: "Trimestral" },
  { key: "SEMIANNUAL", label: "Semestral" },
  { key: "ANNUAL", label: "Anual" },
];

const ALL_BRANCHES = "__all__";

// Preferências visuais dos "filtros avançados" — persistidas em localStorage
// pra que as escolhas de exibição sobrevivam a reloads/navegação.
const DISPLAY_PREFS_STORAGE_KEY = "ranking:display-prefs";

interface DisplayPrefs {
  showScore: boolean;
  showPercent: boolean;
  showSoldValue: boolean;
}

const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  showScore: true,
  showPercent: true,
  showSoldValue: true,
};

// Campos que o board realmente consome — compatível tanto com o payload
// autenticado (ranking.list) quanto com o público (ranking.publicList).
export interface SalesGoalBoardPeriod {
  label: string | null;
  goalTotal: number;
  achievedTotal: number;
  // Todos ausentes no payload público, que é montado por allowlist: margem é
  // estrutura de custo e não sai numa URL sem login (ver `public-list.ts`).
  achievedSourceKind?: "ERP" | "NATIVE";
  marginTotal?: number | null;
  marginPercent?: number | null;
  averageTicket?: number | null;
  ordersTotal?: number;
  projectedTotal?: number | null;
  projectedPercent?: number | null;
  coverageStart?: string | null;
  pace?: { elapsedDays: number; totalDays: number; isClosed: boolean };
  // Recorte de venda ativo + totais dos dois, para o seletor e o indicador
  // secundário. Ausentes na venda nativa (só há um recorte).
  salesMode?: "INVOICED" | "PIPELINE";
  invoicedTotal?: number;
  pipelineTotal?: number;
  branches: {
    id: string;
    name: string;
    goalTotal: number;
    achievedTotal: number;
    entries: SalesGoalRankEntry[];
  }[];
}

export interface SalesGoalBoardSettings {
  displayName: string;
  theme: keyof typeof SALES_GOAL_THEME_STYLES;
  activePeriodTypes: SalesGoalPeriodType[];
  soundEnabled: boolean;
  scoreSoundUrl: string | null;
  overtakeSoundUrl: string | null;
  victorySoundUrl: string | null;
  soundVolume: number;
  prizes: { position: number; label: string; imageUrl?: string }[];
}

interface SalesGoalRankingBoardProps {
  period: SalesGoalBoardPeriod | null | undefined;
  settings: SalesGoalBoardSettings | undefined;
  isLoading: boolean;
  periodType: SalesGoalPeriodType;
  onPeriodTypeChange: (periodType: SalesGoalPeriodType) => void;
  /** Recorte de venda selecionado e seu setter. Ausente = sem seletor (público sem toggle). */
  salesMode?: "INVOICED" | "PIPELINE";
  onSalesModeChange?: (mode: "INVOICED" | "PIPELINE") => void;
  onRefresh: () => void;
  canEdit?: boolean;
  /** Fallback de foto por nome do vendedor. A tela pública já vem resolvida do servidor. */
  photoByName?: Map<string, string | null>;
  /** Ações de administração ao lado do título (importar, configurações...). */
  headerActions?: ReactNode;
  /** Ações extras no grupo de botões da barra de filtros, ao lado do Modo TV. */
  toolbarActions?: ReactNode;
  /**
   * Indicador de estado ao lado da barra de filtros (ex.: última sincronização
   * com o ERP). Fica FORA do `ButtonGroup` de propósito: o grupo remove borda e
   * arredondamento dos filhos para colá-los, o que desmonta qualquer coisa que
   * não seja botão de altura uniforme.
   */
  statusSlot?: ReactNode;
  /** Ações exibidas no estado vazio (configurar ranking, importar planilha). */
  emptyStateActions?: ReactNode;
}

// Painel do ranking: pódio, lista, carrossel de times e Modo TV (fullscreen).
// Usado pela tela interna (com edição) e pela pública/deslogada (só leitura).
export function SalesGoalRankingBoard({
  period,
  settings,
  isLoading,
  periodType,
  onPeriodTypeChange,
  salesMode,
  onSalesModeChange,
  onRefresh,
  canEdit = false,
  photoByName,
  headerActions,
  toolbarActions,
  statusSlot,
  emptyStateActions,
}: SalesGoalRankingBoardProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>(ALL_BRANCHES);
  const [showScore, setShowScore] = useState(DEFAULT_DISPLAY_PREFS.showScore);
  const [showPercent, setShowPercent] = useState(
    DEFAULT_DISPLAY_PREFS.showPercent,
  );
  const [showSoldValue, setShowSoldValue] = useState(
    DEFAULT_DISPLAY_PREFS.showSoldValue,
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(300);
  const [tvMode, setTvMode] = useState(false);
  const [tvControlsVisible, setTvControlsVisible] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const handleFullscreenChange = () =>
      setTvMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Carrega as preferências visuais salvas (uma vez, no cliente). Só depois de
  // hidratar é que o efeito de salvar passa a rodar, evitando sobrescrever o
  // storage com os defaults antes da leitura.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISPLAY_PREFS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<DisplayPrefs>;
        if (typeof saved.showScore === "boolean") setShowScore(saved.showScore);
        if (typeof saved.showPercent === "boolean")
          setShowPercent(saved.showPercent);
        if (typeof saved.showSoldValue === "boolean")
          setShowSoldValue(saved.showSoldValue);
      }
    } catch {
      // ignora preferência inválida/indisponível
    }
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    try {
      window.localStorage.setItem(
        DISPLAY_PREFS_STORAGE_KEY,
        JSON.stringify({
          showScore,
          showPercent,
          showSoldValue,
        } satisfies DisplayPrefs),
      );
    } catch {
      // storage indisponível (ex: modo privado) — segue só em memória
    }
  }, [prefsHydrated, showScore, showPercent, showSoldValue]);

  useEffect(() => {
    if (!tvMode) return;

    const scheduleHide = () => {
      setTvControlsVisible(true);
      if (hideControlsTimeoutRef.current)
        clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(
        () => setTvControlsVisible(false),
        3000,
      );
    };

    scheduleHide();
    const node = panelRef.current;
    node?.addEventListener("mousemove", scheduleHide);
    return () => {
      node?.removeEventListener("mousemove", scheduleHide);
      if (hideControlsTimeoutRef.current)
        clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [tvMode]);

  const toggleTvMode = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await panelRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen indisponível (ex: iframe sem permissão) — TV mode segue só visual.
      setTvMode((current) => !current);
    }
  }, []);

  const theme = SALES_GOAL_THEME_STYLES[settings?.theme ?? "GAMING"];

  const periodTabs = useMemo(() => {
    if (!settings) return ALL_PERIOD_TABS;
    return ALL_PERIOD_TABS.filter((tab) =>
      settings.activePeriodTypes.includes(tab.key),
    );
  }, [settings]);

  const entries: SalesGoalRankEntry[] = useMemo(() => {
    if (!period) return [];
    const branches =
      selectedBranch === ALL_BRANCHES
        ? period.branches
        : period.branches.filter((branch) => branch.id === selectedBranch);
    return (
      branches
        .flatMap((branch) => branch.entries)
        .map((entry) => ({
          ...entry,
          photoUrl:
            entry.photoUrl ??
            photoByName?.get(normalizeCollaboratorName(entry.sellerName)) ??
            null,
        }))
        // Desempate por valor vendido: sem meta cadastrada `percentAchieved` é
        // null para todo mundo, e o `flatMap` acima já concatenou filial por
        // filial — sem este critério o pódio mostraria os primeiros da primeira
        // filial em vez dos maiores vendedores.
        .sort(compareRankEntries)
    );
  }, [period, selectedBranch, photoByName]);

  const goalTotal =
    selectedBranch === ALL_BRANCHES
      ? (period?.goalTotal ?? 0)
      : (period?.branches.find((branch) => branch.id === selectedBranch)
          ?.goalTotal ?? 0);
  const achievedTotal =
    selectedBranch === ALL_BRANCHES
      ? (period?.achievedTotal ?? 0)
      : (period?.branches.find((branch) => branch.id === selectedBranch)
          ?.achievedTotal ?? 0);
  const top3AchievedTotal = entries
    .slice(0, 3)
    .reduce((total, entry) => total + (entry.achievedAmount ?? 0), 0);

  const selectedBranchName =
    selectedBranch === ALL_BRANCHES
      ? "Todas as equipes"
      : (period?.branches.find((branch) => branch.id === selectedBranch)
          ?.name ?? "Equipe");

  // Métricas da faixa de performance escopadas ao filtro de equipe. Para "Todas
  // as equipes" usa os totais do período (incluindo o indicador secundário
  // faturado×pipeline). Para uma filial, recomputa margem/ticket/projeção das
  // entries filtradas e OMITE o secundário — o payload não traz os dois recortes
  // por filial, então mostrar o total da org ao lado do vendido da filial seria
  // enganoso (era o bug: card na filial, métricas na org toda).
  const stripPeriod = useMemo(() => {
    if (!period) return null;
    if (selectedBranch === ALL_BRANCHES) return period;

    const revenue = entries.reduce((t, e) => t + (e.metrics?.revenue ?? 0), 0);
    const cost = entries.reduce((t, e) => t + (e.metrics?.cost ?? 0), 0);
    const orders = entries.reduce((t, e) => t + (e.metrics?.orders ?? 0), 0);
    const ratio =
      period.pace && period.pace.totalDays > 0
        ? period.pace.elapsedDays / period.pace.totalDays
        : 0;
    const projectedTotal = ratio > 0 ? achievedTotal / ratio : null;

    return {
      ...period,
      goalTotal,
      achievedTotal,
      marginTotal: revenue > 0 ? revenue - cost : null,
      marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
      averageTicket: orders > 0 ? revenue / orders : null,
      ordersTotal: orders,
      projectedTotal,
      projectedPercent:
        projectedTotal !== null && goalTotal > 0
          ? (projectedTotal / goalTotal) * 100
          : null,
      // Sem dado dos dois recortes por filial → esconde o indicador secundário.
      invoicedTotal: undefined,
      pipelineTotal: undefined,
    };
  }, [period, selectedBranch, entries, goalTotal, achievedTotal]);

  const teamsForCarousel = useMemo(() => {
    const teams = [{ id: ALL_BRANCHES, name: "Todas" }];
    period?.branches.forEach((branch) => {
      teams.push({ id: branch.id, name: branch.name });
    });
    return teams;
  }, [period]);

  const previousScoresRef = useRef<Map<string, number> | null>(null);
  const previousOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!settings?.soundEnabled) return;
    const previousScores = previousScoresRef.current;
    const previousOrder = previousOrderRef.current;

    if (previousScores) {
      const scoreImproved = entries.some((entry) => {
        const previous = previousScores.get(entry.id);
        return (
          previous !== undefined &&
          entry.percentAchieved !== null &&
          entry.percentAchieved > previous
        );
      });

      const currentOrder = entries.map((entry) => entry.id);
      const overtakeHappened = currentOrder.some((id, index) => {
        const previousIndex = previousOrder.indexOf(id);
        return previousIndex > 0 && previousIndex > index;
      });

      const victoryHappened = entries.some((entry) => {
        const previous = previousScores.get(entry.id);
        return (
          previous !== undefined &&
          previous < 100 &&
          (entry.percentAchieved ?? 0) >= 100
        );
      });

      if (victoryHappened && settings.victorySoundUrl) {
        playSalesGoalSound(settings.victorySoundUrl, settings.soundVolume);
      } else if (scoreImproved && settings.scoreSoundUrl) {
        playSalesGoalSound(settings.scoreSoundUrl, settings.soundVolume);
      }
      if (overtakeHappened && settings.overtakeSoundUrl) {
        playSalesGoalSound(settings.overtakeSoundUrl, settings.soundVolume);
      }
    }

    previousScoresRef.current = new Map(
      entries.map((entry) => [entry.id, entry.percentAchieved ?? 0]),
    );
    previousOrderRef.current = entries.map((entry) => entry.id);
  }, [entries, settings]);

  const prizes = (settings?.prizes ?? []).filter(
    (prize) => prize.label.trim().length > 0,
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {settings?.displayName ?? "Ranking de Equipes"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {/* Sem `achievedSourceKind` (payload público) o texto fica neutro:
              afirmar a origem errada é pior que não afirmar nada. */}
            {period?.achievedSourceKind === "ERP"
              ? "Metas importadas de planilha; vendido sincronizado do ERP."
              : period?.achievedSourceKind === "NATIVE"
                ? "Metas importadas de planilha; vendido calculado das vendas do NERP."
                : "Metas importadas de planilha."}
          </p>
        </div>
        {headerActions}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select
            value={periodType}
            onValueChange={(value) =>
              onPeriodTypeChange(value as SalesGoalPeriodType)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodTabs.map((tab) => (
                <SelectItem key={tab.key} value={tab.key}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-2">
            {statusSlot}
            <ButtonGroup>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="size-3.5" /> Filtros avançados
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3">
                  {/* Recorte de venda: só faz sentido com ERP externo, onde
                    faturado e pipeline diferem. */}
                  {onSalesModeChange &&
                    salesMode &&
                    period?.achievedSourceKind === "ERP" && (
                      <div className="space-y-1.5 border-b pb-3">
                        <span className="text-sm font-medium">
                          Contar venda por
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              ["INVOICED", "Faturado"],
                              ["PIPELINE", "Todos os pedidos"],
                            ] as const
                          ).map(([mode, label]) => (
                            <Button
                              key={mode}
                              type="button"
                              size="sm"
                              variant={
                                salesMode === mode ? "default" : "outline"
                              }
                              onClick={() => onSalesModeChange(mode)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {salesMode === "PIPELINE"
                            ? "Todo pedido não cancelado, como no relatório do Winthor."
                            : "Só nota emitida — receita já faturada."}
                        </p>
                      </div>
                    )}
                  <div className="flex items-center justify-between">
                    <label htmlFor="filter-show-score" className="text-sm">
                      Exibir pontuação
                    </label>
                    <Switch
                      id="filter-show-score"
                      checked={showScore}
                      onCheckedChange={setShowScore}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="filter-show-percent" className="text-sm">
                      Exibir porcentagem
                    </label>
                    <Switch
                      id="filter-show-percent"
                      checked={showPercent}
                      onCheckedChange={setShowPercent}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="filter-show-sold-value" className="text-sm">
                      Exibir valor vendido
                    </label>
                    <Switch
                      id="filter-show-sold-value"
                      checked={showSoldValue}
                      onCheckedChange={setShowSoldValue}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onRefresh}
                title="Atualizar"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={toggleTvMode}
              >
                <Maximize2 className="size-3.5" /> Modo TV
              </Button>
              {toolbarActions}
            </ButtonGroup>
          </div>
        </div>

        {isLoading ? (
          <div className="h-96 rounded-2xl bg-white/5 animate-pulse" />
        ) : !period ? (
          <div className="text-center py-14 text-muted-foreground">
            <p className="text-4xl mb-3">🚀</p>
            <p className="text-sm font-semibold">
              Nenhuma meta cadastrada ainda
            </p>
            <p className="text-xs mt-1 opacity-60">
              Configure o ranking manualmente ou importe a planilha de metas do
              Winthor para este período.
            </p>
            {emptyStateActions && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {emptyStateActions}
              </div>
            )}
          </div>
        ) : (
          <div
            ref={panelRef}
            className={cn(
              "border flex flex-col gap-3 relative [zoom:1] sm:[zoom:1.15]",
              tvMode
                ? "fixed inset-0 z-[60] rounded-none p-8 overflow-y-auto justify-center"
                : "rounded-2xl p-4",
            )}
            style={{
              background: theme.podiumGradient,
              borderColor: `${theme.accent}33`,
            }}
          >
            {tvMode && (
              <div
                className={cn(
                  "absolute top-8 right-8 z-10 transition-opacity duration-500",
                  tvControlsVisible
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none",
                )}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={toggleTvMode}
                >
                  <Minimize2 className="size-3.5" /> Sair do modo TV
                </Button>
              </div>
            )}

            <div
              className={cn(
                "flex flex-col gap-3",
                tvMode && "w-full max-w-7xl mx-auto",
              )}
            >
              <div
                className={cn(
                  "grid grid-cols-1 gap-4",
                  tvMode
                    ? "lg:grid-cols-[minmax(0,60%)_minmax(0,1fr)]"
                    : "lg:grid-cols-[minmax(0,60%)_auto_minmax(0,1fr)]",
                )}
              >
                {/* Painel esquerdo: header do time + pódio */}
                <div className="flex flex-col gap-3">
                  <SalesGoalTeamHeader
                    teamName={selectedBranchName}
                    subtitle="Por percentual de meta"
                    totalLabel="Total do time"
                    totalValue={formatBrl(goalTotal)}
                    top3Label="Vendido top 3"
                    top3Value={formatBrl(top3AchievedTotal)}
                    accent={theme.accent}
                    textOnDark={theme.textOnDark}
                  />
                  <SalesGoalPodium
                    entries={entries.slice(0, 3)}
                    showScore={showScore}
                    showPercent={showPercent}
                    showSoldValue={showSoldValue}
                    podiumGradient={theme.podiumGradient}
                    accent={theme.accent}
                    prizes={prizes}
                  />
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1",
                      theme.textOnDark ? "text-white" : "text-black",
                    )}
                    style={{
                      borderColor: `${theme.accent}33`,
                      background: theme.totalCardGradient,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider opacity-60 truncate">
                        {period.label ?? "Meta do período"}
                      </p>
                      <p className="text-lg font-black truncate">
                        {formatBrl(goalTotal)}
                      </p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-[10px] opacity-60">Vendido</p>
                      <p className="text-base font-bold text-emerald-400 truncate">
                        {formatBrl(achievedTotal)}
                      </p>
                    </div>
                  </div>
                  {/* Só rende com ERP externo; na página pública os campos não
                    vêm no payload e a faixa some sozinha. Escopada à filial
                    selecionada via `stripPeriod`. */}
                  {stripPeriod && (
                    <SalesGoalPerformanceStrip
                      period={stripPeriod}
                      accent={theme.accent}
                      textOnDark={theme.textOnDark}
                    />
                  )}
                </div>

                {/* Trilho de ícones + presets de tempo — some no modo TV pra deixar limpo */}
                {!tvMode && (
                  <SalesGoalSideRail
                    accent={theme.accent}
                    autoAdvanceSeconds={autoAdvanceSeconds}
                    onChangeAutoAdvance={setAutoAdvanceSeconds}
                  />
                )}

                {/* Painel direito: lista em 2 colunas — @container pra reagir à
                  largura real da coluna (não ao viewport), já que o pódio
                  pode ocupar a maior parte da tela e deixar pouco espaço aqui.
                  Altura travada na mesma altura do pódio, com scroll próprio,
                  pra não esticar o quadro do ranking quando há muitas entries. */}
                <div className="min-w-0 @container h-[420px] sm:h-[460px] lg:h-[560px] overflow-y-auto pr-1 flex flex-col gap-2">
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma meta cadastrada para esta equipe.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        {entries.slice(0, 3).map((entry, index) => (
                          <SalesGoalRankRow
                            key={entry.id}
                            entry={entry}
                            position={index + 1}
                            showScore={showScore}
                            showPercent={showPercent}
                            showSoldValue={showSoldValue}
                            accent={theme.accent}
                            canEdit={canEdit}
                            textOnDark={theme.textOnDark}
                            featured
                          />
                        ))}
                      </div>
                      {entries.length > 3 && (
                        <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-2">
                          {entries.slice(3).map((entry, index) => (
                            <SalesGoalRankRow
                              key={entry.id}
                              entry={entry}
                              position={index + 4}
                              showScore={showScore}
                              showPercent={showPercent}
                              showSoldValue={showSoldValue}
                              accent={theme.accent}
                              canEdit={canEdit}
                              textOnDark={theme.textOnDark}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <SalesGoalTeamsCarousel
                teams={teamsForCarousel}
                selectedId={selectedBranch}
                onSelect={setSelectedBranch}
                autoAdvanceSeconds={autoAdvanceSeconds}
                accent={theme.accent}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
