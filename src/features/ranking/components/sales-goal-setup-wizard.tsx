"use client";

import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Plus,
  Target,
  Trash2,
  UserPlus,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CollaboratorForm } from "@/features/collaborators/components/collaborator-form";
import { useQueryCollaborators } from "@/features/collaborators/hooks/use-collaborators";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import {
  useImportSalesGoalRanking,
  useSalesGoalRanking,
} from "../hooks/use-ranking";
import { normalizeCollaboratorName } from "../lib/collaborator-name-match";
import type { SalesGoalPeriodType } from "../lib/sales-goal-xlsx-parser";
import { SalesGoalPhotoUploader } from "./sales-goal-photo-uploader";

const PERIOD_TYPE_OPTIONS: { value: SalesGoalPeriodType; label: string }[] = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

const STEPS = [
  { id: "period", label: "Período", icon: CalendarRange },
  { id: "teams", label: "Equipes", icon: Users },
  { id: "goals", label: "Vendedores e metas", icon: Target },
  { id: "review", label: "Revisão", icon: ClipboardCheck },
] as const;

const UNLINKED_MEMBER_VALUE = "__unlinked__";

interface WizardEntry {
  key: string;
  externalCode: string;
  sellerName: string;
  goalName: string;
  goalAmount: string;
  entryKind: "SELLER" | "BUCKET";
  memberId: string | null;
  photoUrl: string | null;
}

interface WizardTeam {
  key: string;
  name: string;
  isActive: boolean;
  entries: WizardEntry[];
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toDateInputValue(value: Date | string): string {
  return format(new Date(value), "yyyy-MM-dd");
}

// Datas de período vindas do banco são instantes à meia-noite UTC; formatar
// em horário local (como toDateInputValue) desloca um dia em fusos negativos
// e o salvamento criaria um período duplicado com periodStart diferente.
function toUtcDateInputValue(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

// Sugere o intervalo do período corrente pra granularidade escolhida —
// o usuário sempre pode ajustar as datas depois.
function suggestPeriodRange(periodType: SalesGoalPeriodType): {
  start: string;
  end: string;
} {
  const today = new Date();
  switch (periodType) {
    case "DAILY":
      return { start: toDateInputValue(today), end: toDateInputValue(today) };
    case "WEEKLY":
      return {
        start: toDateInputValue(startOfWeek(today, { weekStartsOn: 1 })),
        end: toDateInputValue(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case "MONTHLY":
      return {
        start: toDateInputValue(startOfMonth(today)),
        end: toDateInputValue(endOfMonth(today)),
      };
    case "BIMONTHLY": {
      const start = new Date(
        today.getFullYear(),
        today.getMonth() - (today.getMonth() % 2),
        1,
      );
      return {
        start: toDateInputValue(start),
        end: toDateInputValue(endOfMonth(addMonths(start, 1))),
      };
    }
    case "QUARTERLY":
      return {
        start: toDateInputValue(startOfQuarter(today)),
        end: toDateInputValue(endOfQuarter(today)),
      };
    case "SEMIANNUAL": {
      const start = new Date(
        today.getFullYear(),
        today.getMonth() < 6 ? 0 : 6,
        1,
      );
      return {
        start: toDateInputValue(start),
        end: toDateInputValue(endOfMonth(addMonths(start, 5))),
      };
    }
    case "ANNUAL":
      return {
        start: toDateInputValue(startOfYear(today)),
        end: toDateInputValue(endOfYear(today)),
      };
  }
}

function newKey(): string {
  return crypto.randomUUID();
}

// Código manual (M1, M2…) — mantém o padrão do upsert por externalCode,
// então salvar de novo o mesmo assistente atualiza em vez de duplicar.
function nextManualCode(teams: WizardTeam[]): string {
  const max = teams
    .flatMap((team) => team.entries)
    .map((entry) => /^M(\d+)$/.exec(entry.externalCode))
    .reduce(
      (highest, match) =>
        match ? Math.max(highest, Number(match[1])) : highest,
      0,
    );
  return `M${max + 1}`;
}

function parseGoalAmount(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

interface ExistingPeriodData {
  periodStart: Date | string;
  periodEnd: Date | string;
  label: string | null;
  branches: {
    name: string;
    isActive: boolean;
    entries: {
      externalCode: string;
      goalName: string;
      sellerName: string;
      entryKind: "SELLER" | "BUCKET";
      goalAmount: number;
      memberId: string | null;
      photoUrl: string | null;
    }[];
  }[];
}

interface SalesGoalSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Granularidade selecionada na tela — vira o valor inicial da etapa 1. */
  initialPeriodType: SalesGoalPeriodType;
}

export function SalesGoalSetupWizard({
  open,
  onOpenChange,
  initialPeriodType,
}: SalesGoalSetupWizardProps) {
  const mutation = useImportSalesGoalRanking();
  const membersQuery = useQuery(orpc.members.list.queryOptions({ input: {} }));
  // includeInactiveBranches: sem isso, equipes desativadas ficariam fora do
  // prefill e o prune do salvamento as apagaria silenciosamente.
  const existingQuery = useSalesGoalRanking(
    initialPeriodType,
    undefined,
    undefined,
    true,
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [periodType, setPeriodType] =
    useState<SalesGoalPeriodType>(initialPeriodType);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [label, setLabel] = useState("");
  const [teams, setTeams] = useState<WizardTeam[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [prefilledFromExisting, setPrefilledFromExisting] = useState(false);
  const [collaboratorDraftName, setCollaboratorDraftName] = useState<
    string | null
  >(null);
  const initializedRef = useRef(false);

  const members = membersQuery.data ?? [];
  const collaboratorsQuery = useQueryCollaborators(true);
  const collaboratorNames = useMemo(
    () =>
      new Set(
        (collaboratorsQuery.data ?? []).map((collaborator) =>
          normalizeCollaboratorName(collaborator.name),
        ),
      ),
    [collaboratorsQuery.data],
  );

  // Prefill a partir do período existente (edição) ou defaults (criação),
  // uma única vez por abertura do dialog.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current || existingQuery.isLoading) return;
    initializedRef.current = true;

    const existing = existingQuery.data as
      | ExistingPeriodData
      | null
      | undefined;
    setStepIndex(0);
    setDone(false);
    setAttemptedNext(false);
    setNewTeamName("");
    setPeriodType(initialPeriodType);
    mutation.reset();

    if (existing) {
      setPrefilledFromExisting(true);
      setPeriodStart(toUtcDateInputValue(existing.periodStart));
      setPeriodEnd(toUtcDateInputValue(existing.periodEnd));
      setLabel(existing.label ?? "");
      setTeams(
        existing.branches.map((branch) => ({
          key: newKey(),
          name: branch.name,
          isActive: branch.isActive,
          entries: branch.entries.map((entry) => ({
            key: newKey(),
            externalCode: entry.externalCode,
            sellerName: entry.sellerName,
            goalName: entry.goalName,
            goalAmount: String(entry.goalAmount),
            entryKind: entry.entryKind,
            memberId: entry.memberId,
            photoUrl: entry.photoUrl,
          })),
        })),
      );
    } else {
      setPrefilledFromExisting(false);
      const range = suggestPeriodRange(initialPeriodType);
      setPeriodStart(range.start);
      setPeriodEnd(range.end);
      setLabel("");
      setTeams([]);
    }
  }, [
    open,
    existingQuery.isLoading,
    existingQuery.data,
    initialPeriodType,
    mutation,
  ]);

  const handlePeriodTypeChange = (value: SalesGoalPeriodType) => {
    setPeriodType(value);
    const range = suggestPeriodRange(value);
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
  };

  const updateTeam = (teamKey: string, patch: Partial<WizardTeam>) => {
    setTeams((current) =>
      current.map((team) =>
        team.key === teamKey ? { ...team, ...patch } : team,
      ),
    );
  };

  const moveTeam = (teamKey: string, direction: -1 | 1) => {
    setTeams((current) => {
      const index = current.findIndex((team) => team.key === teamKey);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    setTeams((current) => [
      ...current,
      { key: newKey(), name, isActive: true, entries: [] },
    ]);
    setNewTeamName("");
  };

  const addEntry = (teamKey: string) => {
    setTeams((current) =>
      current.map((team) =>
        team.key === teamKey
          ? {
              ...team,
              entries: [
                ...team.entries,
                {
                  key: newKey(),
                  externalCode: nextManualCode(current),
                  sellerName: "",
                  goalName: "",
                  goalAmount: "",
                  entryKind: "SELLER" as const,
                  memberId: null,
                  photoUrl: null,
                },
              ],
            }
          : team,
      ),
    );
  };

  const updateEntry = (
    teamKey: string,
    entryKey: string,
    patch: Partial<WizardEntry>,
  ) => {
    setTeams((current) =>
      current.map((team) =>
        team.key === teamKey
          ? {
              ...team,
              entries: team.entries.map((entry) =>
                entry.key === entryKey ? { ...entry, ...patch } : entry,
              ),
            }
          : team,
      ),
    );
  };

  const removeEntry = (teamKey: string, entryKey: string) => {
    setTeams((current) =>
      current.map((team) =>
        team.key === teamKey
          ? {
              ...team,
              entries: team.entries.filter((entry) => entry.key !== entryKey),
            }
          : team,
      ),
    );
  };

  const totalEntries = teams.reduce(
    (total, team) => total + team.entries.length,
    0,
  );
  const goalGrandTotal = teams.reduce(
    (total, team) =>
      total +
      team.entries.reduce(
        (sum, entry) => sum + (parseGoalAmount(entry.goalAmount) ?? 0),
        0,
      ),
    0,
  );

  const validateStep = useCallback(
    (index: number): string | null => {
      if (index === 0) {
        if (!periodStart || !periodEnd) return "Informe as datas do período.";
        if (periodStart > periodEnd)
          return "A data inicial deve ser anterior à final.";
        return null;
      }
      if (index === 1) {
        if (teams.length === 0) return "Adicione pelo menos uma equipe.";
        if (teams.some((team) => team.name.trim() === ""))
          return "Toda equipe precisa de um nome.";
        const names = teams.map((team) => team.name.trim().toLowerCase());
        if (new Set(names).size !== names.length)
          return "Há equipes com o mesmo nome.";
        return null;
      }
      if (index === 2) {
        if (totalEntries === 0)
          return "Adicione pelo menos um vendedor com meta.";
        for (const team of teams) {
          for (const entry of team.entries) {
            if (entry.sellerName.trim() === "")
              return `Há um vendedor sem nome na equipe "${team.name}".`;
            if (parseGoalAmount(entry.goalAmount) === null)
              return `Informe a meta de "${entry.sellerName.trim() || "vendedor"}" (${team.name}).`;
          }
        }
        return null;
      }
      return null;
    },
    [periodStart, periodEnd, teams, totalEntries],
  );

  const stepError = validateStep(stepIndex);

  // Primeira etapa (que não a de revisão) com erro — usada pelo botão Salvar
  // pra permitir salvar de qualquer ponto, pulando pro problema se houver.
  const firstInvalidStep = useMemo(() => {
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      if (validateStep(index) !== null) return index;
    }
    return -1;
  }, [validateStep]);

  const goNext = () => {
    if (stepError) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setAttemptedNext(false);
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const handleSave = () => {
    if (firstInvalidStep !== -1) {
      setStepIndex(firstInvalidStep);
      setAttemptedNext(true);
      return;
    }
    mutation.mutate(
      {
        periodType,
        periodStart,
        periodEnd,
        label: label.trim() || undefined,
        prune: true,
        branches: teams.map((team) => ({
          name: team.name.trim(),
          isActive: team.isActive,
          entries: team.entries.map((entry) => ({
            externalCode: entry.externalCode,
            sellerName: entry.sellerName.trim(),
            goalName: entry.goalName.trim() || entry.sellerName.trim(),
            goalAmount: parseGoalAmount(entry.goalAmount) ?? 0,
            entryKind: entry.entryKind,
            memberId: entry.memberId,
            photoUrl: entry.photoUrl,
          })),
        })),
      },
      { onSuccess: () => setDone(true) },
    );
  };

  const periodTypeLabel =
    PERIOD_TYPE_OPTIONS.find((option) => option.value === periodType)?.label ??
    periodType;

  const loading = open && !initializedRef.current && existingQuery.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,52rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>Configurar Ranking de Equipes</DialogTitle>
          <DialogDescription>
            Monte o ranking do zero — sem planilha — ou edite o período atual:
            período, equipes, vendedores, metas e vínculos com membros do NERP.
          </DialogDescription>

          {!done && (
            <div className="mt-3 flex items-center gap-1 overflow-x-auto">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCurrent = index === stepIndex;
                // Navegação livre: qualquer etapa é clicável (edição). "Válida"
                // = passa na validação e não é a etapa de revisão.
                const isValid =
                  index < STEPS.length - 1 && validateStep(index) === null;
                return (
                  <div key={step.id} className="flex items-center gap-1">
                    {index > 0 && (
                      <div
                        className={cn(
                          "h-px w-6 sm:w-10",
                          isValid || isCurrent ? "bg-primary" : "bg-border",
                        )}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAttemptedNext(false);
                        setStepIndex(index);
                      }}
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary/10",
                        isCurrent
                          ? "border-primary bg-primary text-primary-foreground"
                          : isValid
                            ? "border-primary/40 text-primary"
                            : "border-border text-muted-foreground",
                      )}
                    >
                      {isValid && !isCurrent ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{index + 1}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : done ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <CheckCircle2 className="size-12 text-green-500" />
              <p className="text-lg font-semibold">Ranking configurado!</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {totalEntries} metas em {teams.length}{" "}
                {teams.length === 1 ? "equipe" : "equipes"} para o período{" "}
                {periodTypeLabel.toLowerCase()}. Aparência, sons e premiações
                ficam no botão de Configurações da tela de ranking.
              </p>
            </div>
          ) : (
            <>
              {stepIndex === 0 && (
                <div className="mx-auto flex max-w-xl flex-col gap-5">
                  <div className="space-y-1.5">
                    <Label>Granularidade</Label>
                    <Select
                      value={periodType}
                      onValueChange={(value) =>
                        handlePeriodTypeChange(value as SalesGoalPeriodType)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIOD_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Ao trocar a granularidade, as datas são sugeridas
                      automaticamente para o período corrente.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Início</Label>
                      <Input
                        type="date"
                        value={periodStart}
                        onChange={(event) => setPeriodStart(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Fim</Label>
                      <Input
                        type="date"
                        value={periodEnd}
                        onChange={(event) => setPeriodEnd(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Nome do período (opcional)</Label>
                    <Input
                      placeholder="Ex: Metas de Julho"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Aparece no card de meta total da tela de ranking.
                    </p>
                  </div>

                  {prefilledFromExisting && (
                    <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                      Já existe um ranking {periodTypeLabel.toLowerCase()} — os
                      dados dele foram carregados aqui para edição. Mantendo a
                      mesma data de início, salvar atualiza esse período.
                    </p>
                  )}
                </div>
              )}

              {stepIndex === 1 && (
                <div className="mx-auto flex max-w-xl flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Equipes são os grupos disputando o ranking (filiais, times
                    de venda, lojas…). A ordem aqui define a ordem de exibição.
                  </p>

                  {teams.map((team, index) => (
                    <div
                      key={team.key}
                      className="flex items-center gap-2 rounded-md border p-2"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="text-muted-foreground disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveTeam(team.key, -1)}
                          title="Mover para cima"
                        >
                          <ChevronLeft className="size-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground disabled:opacity-30"
                          disabled={index === teams.length - 1}
                          onClick={() => moveTeam(team.key, 1)}
                          title="Mover para baixo"
                        >
                          <ChevronRight className="size-3.5 rotate-90" />
                        </button>
                      </div>
                      <Input
                        value={team.name}
                        placeholder="Nome da equipe"
                        onChange={(event) =>
                          updateTeam(team.key, { name: event.target.value })
                        }
                      />
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {team.entries.length}{" "}
                        {team.entries.length === 1 ? "vendedor" : "vendedores"}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Ativa
                        </Label>
                        <Switch
                          checked={team.isActive}
                          onCheckedChange={(checked) =>
                            updateTeam(team.key, { isActive: checked })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setTeams((current) =>
                            current.filter((item) => item.key !== team.key),
                          )
                        }
                        title="Remover equipe"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <Input
                      value={newTeamName}
                      placeholder="Nova equipe (ex: Loja Centro)"
                      onChange={(event) => setNewTeamName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTeam();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addTeam}
                      disabled={newTeamName.trim() === ""}
                      className="shrink-0 gap-1.5"
                    >
                      <Plus className="size-4" /> Adicionar
                    </Button>
                  </div>
                </div>
              )}

              {stepIndex === 2 && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-muted-foreground">
                    Vincular um vendedor a um membro do NERP faz o valor vendido
                    ser calculado automaticamente das vendas do sistema. Sem
                    vínculo, o vendido é ajustado manualmente na tela de
                    ranking. Use o tipo "Outro" para linhas que não são pessoas
                    (checkout, treinamento…).
                  </p>

                  {teams.map((team) => {
                    const teamTotal = team.entries.reduce(
                      (sum, entry) =>
                        sum + (parseGoalAmount(entry.goalAmount) ?? 0),
                      0,
                    );
                    return (
                      <div key={team.key} className="rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                          <p className="text-sm font-semibold">{team.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              Total: {formatBrl(teamTotal)}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => addEntry(team.key)}
                            >
                              <Plus className="size-3.5" /> Vendedor
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 p-3">
                          {team.entries.length === 0 && (
                            <p className="py-2 text-center text-xs text-muted-foreground">
                              Nenhum vendedor nesta equipe ainda.
                            </p>
                          )}
                          {team.entries.map((entry) => {
                            const trimmedName = entry.sellerName.trim();
                            const isKnownCollaborator =
                              trimmedName !== "" &&
                              collaboratorNames.has(
                                normalizeCollaboratorName(trimmedName),
                              );
                            return (
                              <div
                                key={entry.key}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <SalesGoalPhotoUploader
                                  value={entry.photoUrl}
                                  onChange={(key) =>
                                    updateEntry(team.key, entry.key, {
                                      photoUrl: key,
                                    })
                                  }
                                  name={entry.sellerName}
                                  seed={entry.externalCode}
                                />
                                <Input
                                  className="min-w-40 flex-1"
                                  placeholder="Nome do vendedor"
                                  value={entry.sellerName}
                                  onChange={(event) =>
                                    updateEntry(team.key, entry.key, {
                                      sellerName: event.target.value,
                                    })
                                  }
                                />
                                {trimmedName !== "" &&
                                  (isKnownCollaborator ? (
                                    <CheckCircle2
                                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                      aria-label="Cadastrado em Colaboradores"
                                    />
                                  ) : (
                                    <>
                                      <UserRoundSearch
                                        className="size-3.5 shrink-0 text-muted-foreground"
                                        aria-label="Não encontrado em Colaboradores"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCollaboratorDraftName(trimmedName)
                                        }
                                        title="Cadastrar como colaborador"
                                        className="flex items-center justify-center rounded-full size-4 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                      >
                                        <UserPlus className="size-3.5" />
                                      </button>
                                    </>
                                  ))}
                                <Input
                                  className="w-32"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="Meta (R$)"
                                  value={entry.goalAmount}
                                  onChange={(event) =>
                                    updateEntry(team.key, entry.key, {
                                      goalAmount: event.target.value,
                                    })
                                  }
                                />
                                <Select
                                  value={entry.entryKind}
                                  onValueChange={(value) =>
                                    updateEntry(team.key, entry.key, {
                                      entryKind: value as "SELLER" | "BUCKET",
                                      ...(value === "BUCKET"
                                        ? { memberId: null }
                                        : {}),
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="SELLER">
                                      Vendedor
                                    </SelectItem>
                                    <SelectItem value="BUCKET">
                                      Outro
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select
                                  disabled={entry.entryKind === "BUCKET"}
                                  value={
                                    entry.memberId ?? UNLINKED_MEMBER_VALUE
                                  }
                                  onValueChange={(value) =>
                                    updateEntry(team.key, entry.key, {
                                      memberId:
                                        value === UNLINKED_MEMBER_VALUE
                                          ? null
                                          : value,
                                      ...(value !== UNLINKED_MEMBER_VALUE &&
                                      entry.sellerName.trim() === ""
                                        ? {
                                            sellerName:
                                              members.find(
                                                (member) => member.id === value,
                                              )?.name ?? "",
                                          }
                                        : {}),
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Sem vínculo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={UNLINKED_MEMBER_VALUE}>
                                      Sem vínculo (manual)
                                    </SelectItem>
                                    {members.map((member) => (
                                      <SelectItem
                                        key={member.id}
                                        value={member.id}
                                      >
                                        {member.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    removeEntry(team.key, entry.key)
                                  }
                                  title="Remover vendedor"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {stepIndex === 3 && (
                <div className="mx-auto flex max-w-2xl flex-col gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Período
                    </p>
                    <p className="text-sm font-semibold">
                      {periodTypeLabel}
                      {label.trim() && ` · ${label.trim()}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {periodStart} → {periodEnd}
                    </p>
                  </div>

                  {teams.map((team) => {
                    const teamTotal = team.entries.reduce(
                      (sum, entry) =>
                        sum + (parseGoalAmount(entry.goalAmount) ?? 0),
                      0,
                    );
                    return (
                      <div key={team.key} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold">{team.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {team.entries.length}{" "}
                            {team.entries.length === 1
                              ? "vendedor"
                              : "vendedores"}{" "}
                            · {formatBrl(teamTotal)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {team.entries.map((entry) => (
                            <Badge
                              key={entry.key}
                              variant={
                                entry.entryKind === "BUCKET"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {entry.sellerName.trim()} ·{" "}
                              {formatBrl(
                                parseGoalAmount(entry.goalAmount) ?? 0,
                              )}
                              {entry.memberId && " · vinculado"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    Total geral: <strong>{formatBrl(goalGrandTotal)}</strong> em{" "}
                    <strong>{totalEntries}</strong> metas e{" "}
                    <strong>{teams.length}</strong>{" "}
                    {teams.length === 1 ? "equipe" : "equipes"}.
                  </div>

                  {prefilledFromExisting && (
                    <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-200">
                      Este assistente substitui a configuração do período:
                      equipes e vendedores removidos aqui serão excluídos ao
                      salvar.
                    </p>
                  )}

                  {mutation.error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {mutation.error.message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          {done ? (
            <>
              <span />
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={goBack}
                disabled={stepIndex === 0 || mutation.isPending}
                className="gap-1.5"
              >
                <ChevronLeft className="size-4" /> Voltar
              </Button>

              <div className="flex min-w-0 items-center gap-3">
                {attemptedNext && stepError && (
                  <p className="truncate text-xs text-destructive">
                    {stepError}
                  </p>
                )}
                {stepIndex < STEPS.length - 1 && (
                  // Salvar disponível em qualquer etapa — permite editar e
                  // salvar sem percorrer o passo a passo. Valida tudo e pula
                  // pra primeira etapa com erro, se houver.
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={loading || mutation.isPending}
                    className="gap-1.5"
                  >
                    {mutation.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Salvar
                  </Button>
                )}
                {stepIndex < STEPS.length - 1 ? (
                  <Button
                    onClick={goNext}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    Avançar <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="gap-1.5"
                  >
                    {mutation.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Salvar ranking ({totalEntries}{" "}
                    {totalEntries === 1 ? "meta" : "metas"})
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
      <CollaboratorForm
        open={collaboratorDraftName !== null}
        onOpenChange={(next) => {
          if (!next) setCollaboratorDraftName(null);
        }}
        defaultName={collaboratorDraftName ?? undefined}
      />
    </Dialog>
  );
}
