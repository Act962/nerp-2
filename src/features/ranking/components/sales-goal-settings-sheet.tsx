"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  UserPlus,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { AddCollaboratorButton } from "@/features/collaborators/components/add-collaborator-button";
import { CollaboratorForm } from "@/features/collaborators/components/collaborator-form";
import { useQueryCollaborators } from "@/features/collaborators/hooks/use-collaborators";
import {
  useSalesGoalRankingSettings,
  useUpdateSalesGoalRankingSettings,
  useSalesGoalRanking,
  useUpdateSalesGoalBranch,
  useCreateSalesGoalBranch,
  useDeleteSalesGoalBranch,
  useCreateSalesGoalEntry,
  useDeleteSalesGoalEntry,
  useUpsertSalesGoalEntry,
  useSalesGoalEvolution,
} from "../hooks/use-ranking";
import { normalizeCollaboratorName } from "../lib/collaborator-name-match";
import { formatBrlAmountInput, parseBrlAmount } from "../lib/parse-brl-amount";
import { currentPeriodBounds } from "../lib/sales-goal-period-bounds";
import type { SalesGoalPeriodType } from "../lib/sales-goal-xlsx-parser";
import {
  SALES_GOAL_SOUND_PRESETS,
  playSalesGoalSound,
  type SalesGoalSoundCategory,
} from "../lib/sales-goal-sound-presets";
import { SalesGoalPhotoUploader } from "./sales-goal-photo-uploader";

const PERIOD_OPTIONS: { value: SalesGoalPeriodType; label: string }[] = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

const THEME_OPTIONS = [
  {
    value: "GAMING",
    label: "Gaming",
    swatch: "linear-gradient(135deg,#7a1fe7,#050510)",
  },
  {
    value: "LIGHT",
    label: "Claro",
    swatch: "linear-gradient(135deg,#f8fafc,#cbd5e1)",
  },
  {
    value: "DARK",
    label: "Escuro",
    swatch: "linear-gradient(135deg,#1e293b,#020617)",
  },
  {
    value: "GALAXY",
    label: "Galáxia",
    swatch: "linear-gradient(135deg,#312e81,#701a75)",
  },
] as const;

const PRIZE_POSITIONS = [1, 2, 3, 4] as const;

interface Prize {
  position: number;
  label: string;
  imageUrl?: string;
}

interface SettingsDraft {
  displayName: string;
  theme: "GAMING" | "LIGHT" | "DARK" | "GALAXY";
  activePeriodTypes: SalesGoalPeriodType[];
  soundEnabled: boolean;
  scoreSoundUrl: string;
  overtakeSoundUrl: string;
  victorySoundUrl: string;
  soundVolume: number;
  prizes: Prize[];
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const NONE_SOUND_VALUE = "__none__";
const CUSTOM_SOUND_VALUE = "__custom__";

function SoundPresetPicker({
  category,
  label,
  value,
  onChange,
  volume,
}: {
  category: SalesGoalSoundCategory;
  label: string;
  value: string;
  onChange: (value: string) => void;
  volume: number;
}) {
  const presets = SALES_GOAL_SOUND_PRESETS[category];
  const isKnownPreset = presets.some((preset) => preset.id === value);
  const isCustom = value !== "" && !isKnownPreset;
  const selectValue =
    value === "" ? NONE_SOUND_VALUE : isCustom ? CUSTOM_SOUND_VALUE : value;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Select
          value={selectValue}
          onValueChange={(next) => {
            if (next === CUSTOM_SOUND_VALUE)
              onChange(isCustom ? value : "https://");
            else if (next === NONE_SOUND_VALUE) onChange("");
            else onChange(next);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_SOUND_VALUE}>Nenhum</SelectItem>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_SOUND_VALUE}>
              🔗 Link personalizado…
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!value}
          onClick={() => playSalesGoalSound(value, volume)}
          title="Testar som"
        >
          <Play className="size-3.5" />
        </Button>
      </div>
      {isCustom && (
        <Input
          placeholder="https://.../som.mp3"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

// Roster de vendedores de uma equipe: lista com "remover" + form compacto de
// "+ vendedor" — usado dentro do card da equipe nas Configurações.
function BranchSellersEditor({
  entries,
  onAddSeller,
  addPending,
}: {
  entries: { id: string; sellerName: string; entryKind: "SELLER" | "BUCKET" }[];
  onAddSeller: (name: string, goalAmount: number) => void;
  addPending: boolean;
}) {
  const deleteEntry = useDeleteSalesGoalEntry();
  const [draftName, setDraftName] = useState("");
  const [draftGoal, setDraftGoal] = useState("");

  const handleAdd = () => {
    const goalAmountValue = parseBrlAmount(draftGoal);
    if (!draftName.trim() || goalAmountValue === null || goalAmountValue < 0) {
      toast.error("Preencha nome e meta do vendedor.");
      return;
    }
    onAddSeller(draftName.trim(), goalAmountValue);
    setDraftName("");
    setDraftGoal("");
  };

  return (
    <div className="space-y-1.5 pl-4 sm:pl-6">
      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhum vendedor nesta equipe ainda.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-xs"
            >
              {entry.sellerName}
              <button
                type="button"
                title="Remover vendedor"
                disabled={deleteEntry.isPending}
                onClick={() => {
                  if (
                    window.confirm(`Remover "${entry.sellerName}" da equipe?`)
                  ) {
                    deleteEntry.mutate({ entryId: entry.id });
                  }
                }}
                className="flex items-center justify-center rounded-full size-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          placeholder="Nome do vendedor"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className="h-7 text-xs flex-1 min-w-[120px]"
        />
        <Input
          placeholder="Meta R$"
          inputMode="decimal"
          value={draftGoal}
          onChange={(event) => setDraftGoal(event.target.value)}
          className="h-7 text-xs w-24"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={addPending}
          onClick={handleAdd}
          title="Adicionar vendedor"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TeamsTab({ periodType }: { periodType: SalesGoalPeriodType }) {
  const query = useSalesGoalRanking(periodType, undefined, undefined, true);
  const updateBranch = useUpdateSalesGoalBranch();
  const createBranch = useCreateSalesGoalBranch();
  const deleteBranch = useDeleteSalesGoalBranch();
  const createEntry = useCreateSalesGoalEntry();
  const branches = query.data?.branches ?? [];
  // Com ERP ativo o ranking usa as equipes do Winthor (período virtual, ids
  // sintéticos). Editar não persiste — mostra read-only em vez de controles que
  // falhariam em silêncio (NOT_FOUND).
  const isErpSourced = query.data?.achievedSourceKind === "ERP";
  const [newTeamName, setNewTeamName] = useState("");

  const bounds = query.data
    ? {
        periodStart: new Date(query.data.periodStart)
          .toISOString()
          .slice(0, 10),
        periodEnd: new Date(query.data.periodEnd).toISOString().slice(0, 10),
      }
    : currentPeriodBounds(periodType);

  const handleAddTeam = () => {
    if (!newTeamName.trim()) {
      toast.error("Informe o nome da equipe.");
      return;
    }
    createBranch.mutate(
      {
        periodType,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        branchName: newTeamName.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Equipe adicionada!");
          setNewTeamName("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (query.isLoading)
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  if (isErpSourced) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          As equipes vêm do ERP (Winthor), pelo supervisor de cada vendedor, e
          são atualizadas a cada sincronização — não são editáveis aqui.
        </p>
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="flex items-center justify-between gap-2 rounded-md border p-2"
          >
            <span className="text-sm font-medium">{branch.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {branch.entries.length}{" "}
              {branch.entries.length === 1 ? "vendedor" : "vendedores"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Renomear/reordenar aqui vale até o próximo import da planilha (que
        recria a equipe pelo nome original). "Meta geral" da equipe, quando
        preenchida, sobrescreve a soma das metas dos vendedores dela.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          placeholder="Nome da nova equipe"
          value={newTeamName}
          onChange={(event) => setNewTeamName(event.target.value)}
          className="h-8 text-sm flex-1 min-w-[140px]"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={createBranch.isPending}
          onClick={handleAddTeam}
        >
          <Plus className="size-3.5" /> Nova equipe
        </Button>
      </div>

      {branches.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma equipe cadastrada ainda para este período.
        </p>
      )}

      {branches.map((branch, index) => (
        <div key={branch.id} className="space-y-2 rounded-md border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="disabled:opacity-30"
                disabled={index === 0}
                onClick={() =>
                  updateBranch.mutate({
                    branchId: branch.id,
                    sortOrder: index - 1,
                  })
                }
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                className="disabled:opacity-30"
                disabled={index === branches.length - 1}
                onClick={() =>
                  updateBranch.mutate({
                    branchId: branch.id,
                    sortOrder: index + 1,
                  })
                }
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            <Input
              defaultValue={branch.name}
              className="flex-1 min-w-[140px]"
              onBlur={(event) => {
                if (event.target.value !== branch.name) {
                  updateBranch.mutate({
                    branchId: branch.id,
                    name: event.target.value,
                  });
                }
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <Label className="text-xs">Ativa</Label>
              <Switch
                checked={branch.isActive}
                onCheckedChange={(checked) =>
                  updateBranch.mutate({
                    branchId: branch.id,
                    isActive: checked,
                  })
                }
              />
            </div>
            <button
              type="button"
              title="Remover equipe"
              disabled={deleteBranch.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Remover a equipe "${branch.name}" e todos os seus vendedores?`,
                  )
                ) {
                  deleteBranch.mutate({ branchId: branch.id });
                }
              }}
              className="flex items-center justify-center rounded-md size-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pl-4 sm:pl-6">
            <Label className="text-[11px] text-muted-foreground">
              Meta geral da equipe (opcional)
            </Label>
            <Input
              key={branch.goalAmountOverride ?? "empty"}
              defaultValue={
                branch.goalAmountOverride !== null
                  ? formatBrlAmountInput(branch.goalAmountOverride)
                  : ""
              }
              placeholder="Soma dos vendedores"
              inputMode="decimal"
              className="h-7 text-xs w-32"
              onBlur={(event) => {
                const raw = event.target.value.trim();
                const nextValue = raw ? parseBrlAmount(raw) : null;
                if (nextValue !== branch.goalAmountOverride) {
                  updateBranch.mutate({
                    branchId: branch.id,
                    goalAmountOverride: nextValue,
                  });
                }
              }}
            />
          </div>

          <BranchSellersEditor
            entries={branch.entries}
            addPending={createEntry.isPending}
            onAddSeller={(name, goalAmountValue) =>
              createEntry.mutate(
                {
                  periodType,
                  periodStart: bounds.periodStart,
                  periodEnd: bounds.periodEnd,
                  branchName: branch.name,
                  sellerName: name,
                  goalAmount: goalAmountValue,
                },
                { onError: (error) => toast.error(error.message) },
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

const UNLINKED_MEMBER_VALUE = "__unlinked__";

// Form compacto de "+ vendedor" no rodapé de cada equipe, na aba Vendedores.
function AddSellerInline({
  branchName,
  onAdd,
  addPending,
}: {
  branchName: string;
  onAdd: (name: string, goalAmount: number) => void;
  addPending: boolean;
}) {
  const [draftName, setDraftName] = useState("");
  const [draftGoal, setDraftGoal] = useState("");

  const handleAdd = () => {
    const goalAmountValue = parseBrlAmount(draftGoal);
    if (!draftName.trim() || goalAmountValue === null || goalAmountValue < 0) {
      toast.error("Preencha nome e meta do vendedor.");
      return;
    }
    onAdd(draftName.trim(), goalAmountValue);
    setDraftName("");
    setDraftGoal("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input
        placeholder={`Novo vendedor em ${branchName}`}
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        className="h-7 text-xs flex-1 min-w-[140px]"
      />
      <Input
        placeholder="Meta R$"
        inputMode="decimal"
        value={draftGoal}
        onChange={(event) => setDraftGoal(event.target.value)}
        className="h-7 text-xs w-24"
      />
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        disabled={addPending}
        onClick={handleAdd}
        title="Adicionar vendedor"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function SellersTab({ periodType }: { periodType: SalesGoalPeriodType }) {
  const rankingQuery = useSalesGoalRanking(
    periodType,
    undefined,
    undefined,
    true,
  );
  const membersQuery = useQuery(orpc.members.list.queryOptions({ input: {} }));
  const collaboratorsQuery = useQueryCollaborators(true);
  const upsertEntry = useUpsertSalesGoalEntry();
  const deleteEntry = useDeleteSalesGoalEntry();
  const createEntry = useCreateSalesGoalEntry();
  const branches = rankingQuery.data?.branches ?? [];
  const members = membersQuery.data ?? [];
  const collaborators = collaboratorsQuery.data ?? [];
  const collaboratorNames = new Set(
    collaborators.map((collaborator) =>
      normalizeCollaboratorName(collaborator.name),
    ),
  );
  const [collaboratorDraftName, setCollaboratorDraftName] = useState<
    string | null
  >(null);

  const isLoading = rankingQuery.isLoading || membersQuery.isLoading;
  const bounds = rankingQuery.data
    ? {
        periodStart: new Date(rankingQuery.data.periodStart)
          .toISOString()
          .slice(0, 10),
        periodEnd: new Date(rankingQuery.data.periodEnd)
          .toISOString()
          .slice(0, 10),
      }
    : currentPeriodBounds(periodType);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground min-w-[200px] flex-1">
          Vincule cada vendedor da planilha a um membro do NERP para que o valor
          vendido seja calculado automaticamente das vendas do sistema. Mesmo
          vinculado, digitar um valor em "Vendido" sobrescreve esse cálculo
          (útil quando parte das vendas não está no NERP) — o ↺ ao lado do campo
          devolve a entry ao automático. O nome é comparado ao cadastro de{" "}
          <a href="/colaboradores" className="underline">
            Colaboradores
          </a>{" "}
          para ajudar a identificar quem é quem.
        </p>
        <div className="shrink-0">
          <AddCollaboratorButton />
        </div>
      </div>

      {isLoading && (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      )}

      {!isLoading && branches.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma equipe importada ainda para este período.
        </p>
      )}

      {!isLoading &&
        branches.map((branch) => (
          <div key={branch.id} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {branch.name}
            </p>
            {branch.entries.map((entry) => {
              const isKnownCollaborator = collaboratorNames.has(
                normalizeCollaboratorName(entry.sellerName),
              );
              // Entry vinculada cujo vendido veio de um valor digitado, e não
              // da soma das vendas — só nesse caso faz sentido oferecer o
              // "voltar ao automático".
              const isManualOverride =
                entry.memberId !== null && entry.achievedSource === "MANUAL";
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border p-2"
                >
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {entry.sellerName}
                      </p>
                      {isKnownCollaborator ? (
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
                              setCollaboratorDraftName(entry.sellerName)
                            }
                            title="Cadastrar como colaborador"
                            className="flex items-center justify-center rounded-full size-4 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <UserPlus className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Código {entry.externalCode}
                      {entry.entryKind === "BUCKET" && " · sempre manual"}
                      {entry.achievedSource === "AUTO" &&
                        " · vendido automático"}
                      {isManualOverride && " · vendido manual (sobrescrito)"}
                      {!isKnownCollaborator &&
                        " · sem correspondência em Colaboradores"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor={`goal-${entry.id}`}
                        className="text-[10px] text-muted-foreground"
                      >
                        Meta
                      </Label>
                      <Input
                        id={`goal-${entry.id}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={formatBrlAmountInput(entry.goalAmount)}
                        onBlur={(event) => {
                          const nextGoalAmount = parseBrlAmount(
                            event.target.value,
                          );
                          if (
                            nextGoalAmount !== null &&
                            nextGoalAmount !== entry.goalAmount
                          ) {
                            upsertEntry.mutate({
                              entryId: entry.id,
                              goalAmount: nextGoalAmount,
                            });
                          }
                          event.target.value = formatBrlAmountInput(
                            nextGoalAmount ?? entry.goalAmount,
                          );
                        }}
                        className="w-24 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Label
                          htmlFor={`achieved-${entry.id}`}
                          className="text-[10px] text-muted-foreground"
                        >
                          Vendido
                        </Label>
                        {isManualOverride && (
                          <button
                            type="button"
                            onClick={() =>
                              upsertEntry.mutate({
                                entryId: entry.id,
                                achievedAmount: null,
                              })
                            }
                            title="Voltar ao vendido automático (soma das vendas do sistema)"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        )}
                      </div>
                      <Input
                        // Remonta quando a origem do vendido muda (override
                        // aplicado ou desfeito) — o input é uncontrolled.
                        key={entry.achievedSource}
                        id={`achieved-${entry.id}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={formatBrlAmountInput(
                          entry.achievedAmount ?? 0,
                        )}
                        onBlur={(event) => {
                          const nextAchievedAmount = parseBrlAmount(
                            event.target.value,
                          );
                          if (
                            nextAchievedAmount !== null &&
                            nextAchievedAmount !== (entry.achievedAmount ?? 0)
                          ) {
                            upsertEntry.mutate({
                              entryId: entry.id,
                              achievedAmount: nextAchievedAmount,
                            });
                          }
                          event.target.value = formatBrlAmountInput(
                            nextAchievedAmount ?? entry.achievedAmount ?? 0,
                          );
                        }}
                        className="w-24 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Select
                      value={branch.id}
                      onValueChange={(value) => {
                        if (value !== branch.id) {
                          upsertEntry.mutate(
                            { entryId: entry.id, branchId: value },
                            { onError: (error) => toast.error(error.message) },
                          );
                        }
                      }}
                    >
                      <SelectTrigger className="w-32" title="Equipe">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      disabled={entry.entryKind === "BUCKET"}
                      value={entry.memberId ?? UNLINKED_MEMBER_VALUE}
                      onValueChange={(value) =>
                        upsertEntry.mutate({
                          entryId: entry.id,
                          memberId:
                            value === UNLINKED_MEMBER_VALUE ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Sem vínculo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNLINKED_MEMBER_VALUE}>
                          Sem vínculo (manual)
                        </SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      title="Remover vendedor"
                      disabled={deleteEntry.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remover "${entry.sellerName}" do ranking?`,
                          )
                        ) {
                          deleteEntry.mutate({ entryId: entry.id });
                        }
                      }}
                      className="flex items-center justify-center rounded-md size-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            <AddSellerInline
              branchName={branch.name}
              addPending={createEntry.isPending}
              onAdd={(name, goalAmountValue) =>
                createEntry.mutate(
                  {
                    periodType,
                    periodStart: bounds.periodStart,
                    periodEnd: bounds.periodEnd,
                    branchName: branch.name,
                    sellerName: name,
                    goalAmount: goalAmountValue,
                  },
                  { onError: (error) => toast.error(error.message) },
                )
              }
            />
          </div>
        ))}
      <CollaboratorForm
        open={collaboratorDraftName !== null}
        onOpenChange={(next) => {
          if (!next) setCollaboratorDraftName(null);
        }}
        defaultName={collaboratorDraftName ?? undefined}
      />
    </div>
  );
}

function EvolutionTab() {
  const query = useSalesGoalEvolution();
  const points = (query.data ?? []).map((point) => ({
    name:
      point.label ?? new Date(point.periodStart).toLocaleDateString("pt-BR"),
    Meta: point.goalTotal,
    Vendido: point.achievedTotal,
  }));

  if (query.isLoading)
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem histórico suficiente ainda.
      </p>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
          />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => formatBrl(value)}
            width={90}
          />
          <Tooltip formatter={(value) => formatBrl(Number(value ?? 0))} />
          <Legend />
          <Line
            type="monotone"
            dataKey="Meta"
            stroke="#7a1fe7"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="Vendido"
            stroke="#10b981"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SalesGoalSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenWizard: () => void;
  currentPeriodType: SalesGoalPeriodType;
}

export function SalesGoalSettingsSheet({
  open,
  onOpenChange,
  onOpenWizard,
  currentPeriodType,
}: SalesGoalSettingsSheetProps) {
  const settingsQuery = useSalesGoalRankingSettings();
  const updateSettings = useUpdateSalesGoalRankingSettings();

  const [draft, setDraft] = useState<SettingsDraft | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft({
        displayName: settingsQuery.data.displayName,
        theme: settingsQuery.data.theme,
        activePeriodTypes: settingsQuery.data.activePeriodTypes,
        soundEnabled: settingsQuery.data.soundEnabled,
        scoreSoundUrl: settingsQuery.data.scoreSoundUrl ?? "",
        overtakeSoundUrl: settingsQuery.data.overtakeSoundUrl ?? "",
        victorySoundUrl: settingsQuery.data.victorySoundUrl ?? "",
        soundVolume: settingsQuery.data.soundVolume,
        prizes: settingsQuery.data.prizes,
      });
    }
  }, [settingsQuery.data]);

  const togglePeriodType = (value: SalesGoalPeriodType) => {
    setDraft((current) => {
      if (!current) return current;
      const has = current.activePeriodTypes.includes(value);
      const next = has
        ? current.activePeriodTypes.filter((item) => item !== value)
        : [...current.activePeriodTypes, value];
      return {
        ...current,
        activePeriodTypes: next.length > 0 ? next : current.activePeriodTypes,
      };
    });
  };

  const updatePrize = (position: number, patch: Partial<Prize>) => {
    setDraft((current) => {
      if (!current) return current;
      const existing = current.prizes.find(
        (prize) => prize.position === position,
      );
      const nextPrize = { position, label: "", ...existing, ...patch };
      const prizes = current.prizes.filter(
        (prize) => prize.position !== position,
      );
      return {
        ...current,
        prizes: [...prizes, nextPrize].sort((a, b) => a.position - b.position),
      };
    });
  };

  const handleSave = () => {
    if (!draft) return;
    updateSettings.mutate({
      displayName: draft.displayName.trim() || "Ranking de Equipes",
      theme: draft.theme,
      activePeriodTypes: draft.activePeriodTypes,
      soundEnabled: draft.soundEnabled,
      scoreSoundUrl: draft.scoreSoundUrl || null,
      overtakeSoundUrl: draft.overtakeSoundUrl || null,
      victorySoundUrl: draft.victorySoundUrl || null,
      soundVolume: draft.soundVolume,
      prizes: draft.prizes.filter((prize) => prize.label.trim().length > 0),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Configurações do Ranking de Equipes</SheetTitle>
          <SheetDescription>
            Equipes, vendedores, aparência, sons, premiações, período e
            evolução. Para recriar o ranking do zero, use o assistente de
            configuração.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={onOpenWizard}
            >
              <Sliders className="size-3.5" /> Abrir assistente de configuração
            </Button>
          </div>

          {!draft ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Tabs defaultValue="teams">
              <TabsList className="w-full h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="teams">Equipes</TabsTrigger>
                <TabsTrigger value="sellers">Vendedores</TabsTrigger>
                <TabsTrigger value="appearance">Aparência</TabsTrigger>
                <TabsTrigger value="sound">Sons</TabsTrigger>
                <TabsTrigger value="prizes">Premiações</TabsTrigger>
                <TabsTrigger value="period">Período</TabsTrigger>
                <TabsTrigger value="evolution">Evolução</TabsTrigger>
              </TabsList>

              <TabsContent value="teams" className="mt-4">
                <TeamsTab periodType={currentPeriodType} />
              </TabsContent>

              <TabsContent value="sellers" className="mt-4">
                <SellersTab periodType={currentPeriodType} />
              </TabsContent>

              <TabsContent value="period" className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Escolha quais granularidades aparecem como abas na tela de
                  ranking.
                </p>
                {PERIOD_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <Label className="text-sm">{option.label}</Label>
                    <Switch
                      checked={draft.activePeriodTypes.includes(option.value)}
                      onCheckedChange={() => togglePeriodType(option.value)}
                    />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="sound" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Sons habilitados</Label>
                  <Switch
                    checked={draft.soundEnabled}
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, soundEnabled: checked })
                    }
                  />
                </div>
                <SoundPresetPicker
                  category="score"
                  label="Som de pontuação (toca em qualquer alteração)"
                  value={draft.scoreSoundUrl}
                  onChange={(value) =>
                    setDraft({ ...draft, scoreSoundUrl: value })
                  }
                  volume={draft.soundVolume}
                />
                <SoundPresetPicker
                  category="overtake"
                  label="Som de ultrapassagem (toca quando alguém sobe no ranking)"
                  value={draft.overtakeSoundUrl}
                  onChange={(value) =>
                    setDraft({ ...draft, overtakeSoundUrl: value })
                  }
                  volume={draft.soundVolume}
                />
                <SoundPresetPicker
                  category="victory"
                  label="Som de vitória (toca quando alguém bate 100% da meta)"
                  value={draft.victorySoundUrl}
                  onChange={(value) =>
                    setDraft({ ...draft, victorySoundUrl: value })
                  }
                  volume={draft.soundVolume}
                />
                <p className="text-[11px] text-muted-foreground">
                  Os presets acima são sons sintetizados (sem áudio externo). Se
                  quiser um link próprio, escolha "Link personalizado…" e cole a
                  URL — só use áudio que vocês tenham direito de usar (não
                  incluímos trilhas oficiais de F1 nem hinos de pilotos por
                  padrão, são protegidos por direitos autorais).
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Volume ({Math.round(draft.soundVolume * 100)}%)
                  </Label>
                  <Slider
                    value={[draft.soundVolume * 100]}
                    max={100}
                    step={5}
                    onValueChange={([value]) =>
                      setDraft({ ...draft, soundVolume: value / 100 })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="prizes" className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Premiação exibida acima do pódio pra 1º–4º colocado (ex:
                  "R$100 iFood", "Folga remunerada"). A imagem (opcional) só é
                  salva junto quando há um texto no prêmio.
                </p>
                {PRIZE_POSITIONS.map((position) => {
                  const prize = draft.prizes.find(
                    (item) => item.position === position,
                  );
                  return (
                    <div key={position} className="flex items-center gap-2">
                      <span className="w-6 text-sm font-bold text-muted-foreground shrink-0">
                        {position}º
                      </span>
                      <SalesGoalPhotoUploader
                        value={prize?.imageUrl ?? null}
                        onChange={(key) =>
                          updatePrize(position, { imageUrl: key ?? undefined })
                        }
                        name={`${position}`}
                        seed={`prize-${position}`}
                        size={36}
                      />
                      <Input
                        placeholder="Ex: R$100 iFood"
                        value={prize?.label ?? ""}
                        onChange={(event) =>
                          updatePrize(position, { label: event.target.value })
                        }
                      />
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="evolution" className="mt-4">
                <EvolutionTab />
              </TabsContent>

              <TabsContent value="appearance" className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título do ranking</Label>
                  <Input
                    placeholder="Ranking de Equipes"
                    value={draft.displayName}
                    onChange={(event) =>
                      setDraft({ ...draft, displayName: event.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Exibido no topo da tela de ranking.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((theme) => (
                    <button
                      type="button"
                      key={theme.value}
                      onClick={() => setDraft({ ...draft, theme: theme.value })}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        draft.theme === theme.value
                          ? "border-[#7a1fe7]"
                          : "border-transparent"
                      }`}
                    >
                      <div
                        className="h-12 w-full rounded-md mb-2"
                        style={{ background: theme.swatch }}
                      />
                      <p className="text-sm font-semibold">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={!draft || updateSettings.isPending}
          >
            {updateSettings.isPending && (
              <Loader2 className="size-4 animate-spin mr-1" />
            )}
            Salvar alterações
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
