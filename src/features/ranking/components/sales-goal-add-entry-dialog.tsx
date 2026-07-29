"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useQueryCollaborators } from "@/features/collaborators/hooks/use-collaborators";
import {
  useCreateSalesGoalBranch,
  useCreateSalesGoalEntry,
  useUpdateSalesGoalPeriod,
} from "../hooks/use-ranking";
import { parseBrlAmount } from "../lib/parse-brl-amount";
import { currentPeriodBounds } from "../lib/sales-goal-period-bounds";
import type { SalesGoalPeriodType } from "../lib/sales-goal-xlsx-parser";

interface SalesGoalAddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodType: SalesGoalPeriodType;
  existingPeriod?: {
    periodStart: string | Date;
    periodEnd: string | Date;
    overallGoalAmount?: number | null;
  } | null;
  existingBranchNames: string[];
}

type AddMode = "SELLER" | "TEAM" | "OVERALL";

const MODE_OPTIONS: { value: AddMode; label: string }[] = [
  { value: "SELLER", label: "Vendedor" },
  { value: "TEAM", label: "Meta da equipe" },
  { value: "OVERALL", label: "Meta geral do mês" },
];

function toIsoDate(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function SalesGoalAddEntryDialog({
  open,
  onOpenChange,
  periodType,
  existingPeriod,
  existingBranchNames,
}: SalesGoalAddEntryDialogProps) {
  const collaboratorsQuery = useQueryCollaborators(true);
  const collaborators = collaboratorsQuery.data ?? [];
  const createEntry = useCreateSalesGoalEntry();
  const createBranch = useCreateSalesGoalBranch();
  const updatePeriod = useUpdateSalesGoalPeriod();
  const isPending =
    createEntry.isPending || createBranch.isPending || updatePeriod.isPending;

  const [mode, setMode] = useState<AddMode>("SELLER");
  const [branchName, setBranchName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [achievedAmount, setAchievedAmount] = useState("");
  const [teamGoalAmount, setTeamGoalAmount] = useState("");
  const [overallGoalAmount, setOverallGoalAmount] = useState("");

  const reset = () => {
    setMode("SELLER");
    setBranchName("");
    setSellerName("");
    setGoalAmount("");
    setAchievedAmount("");
    setTeamGoalAmount("");
    setOverallGoalAmount("");
  };

  const periodBounds = () =>
    existingPeriod
      ? {
          periodStart: toIsoDate(existingPeriod.periodStart),
          periodEnd: toIsoDate(existingPeriod.periodEnd),
        }
      : currentPeriodBounds(periodType);

  const handleSubmitSeller = () => {
    const goalAmountValue = parseBrlAmount(goalAmount);
    if (
      !branchName.trim() ||
      !sellerName.trim() ||
      goalAmountValue === null ||
      goalAmountValue < 0
    ) {
      toast.error("Preencha equipe, vendedor e meta corretamente.");
      return;
    }
    const achievedAmountValue = achievedAmount
      ? parseBrlAmount(achievedAmount)
      : null;
    const bounds = periodBounds();

    createEntry.mutate(
      {
        periodType,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        branchName: branchName.trim(),
        sellerName: sellerName.trim(),
        goalAmount: goalAmountValue,
        achievedAmount: achievedAmountValue ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success("Meta adicionada ao ranking!");
          reset();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleSubmitTeam = () => {
    const teamGoalAmountValue = parseBrlAmount(teamGoalAmount);
    if (
      !branchName.trim() ||
      teamGoalAmountValue === null ||
      teamGoalAmountValue < 0
    ) {
      toast.error("Preencha a equipe e a meta corretamente.");
      return;
    }
    const bounds = periodBounds();

    createBranch.mutate(
      {
        periodType,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        branchName: branchName.trim(),
        goalAmountOverride: teamGoalAmountValue,
      },
      {
        onSuccess: () => {
          toast.success("Meta da equipe definida!");
          reset();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleSubmitOverall = () => {
    const overallGoalAmountValue = parseBrlAmount(overallGoalAmount);
    if (overallGoalAmountValue === null || overallGoalAmountValue < 0) {
      toast.error("Informe a meta geral do mês corretamente.");
      return;
    }
    const bounds = periodBounds();

    updatePeriod.mutate(
      {
        periodType,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        overallGoalAmount: overallGoalAmountValue,
      },
      {
        onSuccess: () => {
          toast.success("Meta geral do mês definida!");
          reset();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleSubmit = () => {
    if (mode === "SELLER") handleSubmitSeller();
    else if (mode === "TEAM") handleSubmitTeam();
    else handleSubmitOverall();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar equipe e meta</DialogTitle>
          <DialogDescription>
            Adicione um vendedor com meta, defina a meta geral de uma equipe, ou
            a meta geral do mês — sem precisar importar planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1.5">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                mode === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === "SELLER" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sales-goal-branch-name">Equipe</Label>
              <Input
                id="sales-goal-branch-name"
                list="sales-goal-branch-suggestions"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="Ex: Loja Centro"
              />
              <datalist id="sales-goal-branch-suggestions">
                {existingBranchNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sales-goal-seller-name">Vendedor</Label>
              <Input
                id="sales-goal-seller-name"
                list="sales-goal-seller-suggestions"
                value={sellerName}
                onChange={(event) => setSellerName(event.target.value)}
                placeholder="Nome do vendedor"
              />
              <datalist id="sales-goal-seller-suggestions">
                {collaborators.map((collaborator) => (
                  <option key={collaborator.id} value={collaborator.name} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sales-goal-goal-amount">Meta (R$)</Label>
                <Input
                  id="sales-goal-goal-amount"
                  type="text"
                  inputMode="decimal"
                  value={goalAmount}
                  onChange={(event) => setGoalAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sales-goal-achieved-amount">Vendido (R$)</Label>
                <Input
                  id="sales-goal-achieved-amount"
                  type="text"
                  inputMode="decimal"
                  value={achievedAmount}
                  onChange={(event) => setAchievedAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
        )}

        {mode === "TEAM" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Define uma meta geral para a equipe, independente da soma das
              metas de cada vendedor dela.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="sales-goal-team-branch-name">Equipe</Label>
              <Input
                id="sales-goal-team-branch-name"
                list="sales-goal-branch-suggestions"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="Ex: Loja Centro"
              />
              <datalist id="sales-goal-branch-suggestions">
                {existingBranchNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sales-goal-team-goal-amount">
                Meta geral da equipe (R$)
              </Label>
              <Input
                id="sales-goal-team-goal-amount"
                type="text"
                inputMode="decimal"
                value={teamGoalAmount}
                onChange={(event) => setTeamGoalAmount(event.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
        )}

        {mode === "OVERALL" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Define a meta geral do mês (todas as equipes juntas), independente
              da soma das metas de cada equipe.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="sales-goal-overall-goal-amount">
                Meta geral do mês (R$)
              </Label>
              <Input
                id="sales-goal-overall-goal-amount"
                type="text"
                inputMode="decimal"
                value={overallGoalAmount}
                onChange={(event) => setOverallGoalAmount(event.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {mode === "SELLER" ? "Adicionar" : "Salvar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
