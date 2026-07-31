"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBrlAmountInput,
  parseBrlAmount,
} from "@/features/ranking/lib/parse-brl-amount";
import {
  useCreateSalesGoal,
  useDeleteSalesGoal,
  useSalesGoals,
  useUpdateSalesGoal,
} from "../hooks/use-sales-goals";

const SCOPE_OPTIONS = [
  { value: "geral", label: "Geral (organização)" },
  { value: "supervisor", label: "Supervisor" },
  { value: "usuario", label: "Usuário (RCA)" },
] as const;

const SCOPE_LABEL: Record<string, string> = {
  geral: "Geral",
  supervisor: "Supervisor",
  usuario: "Usuário (RCA)",
};

const MONTH_OPTIONS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
].map((label, index) => ({ value: index + 1, label }));

type Scope = (typeof SCOPE_OPTIONS)[number]["value"];

export function SalesGoalsAdmin({
  open,
  onOpenChange,
  defaultYear,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultYear: number;
  defaultMonth: number;
}) {
  const { data, isLoading } = useSalesGoals();
  const createGoal = useCreateSalesGoal();
  const updateGoal = useUpdateSalesGoal();
  const deleteGoal = useDeleteSalesGoal();

  const [scope, setScope] = useState<Scope>("supervisor");
  const [scopeCode, setScopeCode] = useState("");
  const [label, setLabel] = useState("");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [value, setValue] = useState("");

  const handleCreate = () => {
    const numericValue = parseBrlAmount(value);
    if (!label.trim() || numericValue === null) {
      toast.error("Informe rótulo e valor corretamente.");
      return;
    }
    if (scope !== "geral" && !scopeCode.trim()) {
      toast.error("Informe o código do supervisor/RCA (Winthor).");
      return;
    }
    createGoal.mutate(
      {
        scope,
        scopeCode: scope === "geral" ? undefined : scopeCode.trim(),
        label: label.trim(),
        year,
        month,
        value: numericValue,
      },
      {
        onSuccess: () => {
          setLabel("");
          setScopeCode("");
          setValue("");
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Metas de vendas</SheetTitle>
          <SheetDescription>
            Meta por período (mês/ano), escopo geral, por supervisor ou por
            usuário (RCA) — combinada com a venda real do Winthor pra calcular
            Vl.meta e %Meta nos widgets.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap gap-2">
              <div className="w-40 space-y-1">
                <Label className="text-xs">Escopo</Label>
                <Select
                  value={scope}
                  onValueChange={(next) => setScope(next as Scope)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {scope !== "geral" && (
                <div className="w-32 space-y-1">
                  <Label className="text-xs">
                    Código {scope === "supervisor" ? "supervisor" : "RCA"}
                  </Label>
                  <Input
                    placeholder="Ex: 12"
                    value={scopeCode}
                    onChange={(event) => setScopeCode(event.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              )}
              <div className="min-w-[140px] flex-1 space-y-1">
                <Label className="text-xs">Rótulo</Label>
                <Input
                  placeholder="Ex: João da Silva"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-36 space-y-1">
                <Label className="text-xs">Mês</Label>
                <Select
                  value={String(month)}
                  onValueChange={(next) => setMonth(Number(next))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Ano</Label>
                <Input
                  inputMode="numeric"
                  value={year}
                  onChange={(event) =>
                    setYear(Number(event.target.value) || year)
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Vl. meta</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                disabled={createGoal.isPending}
                onClick={handleCreate}
              >
                <Plus className="size-3.5" /> Salvar
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (data?.goals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma meta cadastrada ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {(data?.goals ?? []).map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {goal.label}
                      {goal.scopeCode && (
                        <span className="ml-1 text-muted-foreground">
                          ({goal.scopeCode})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {SCOPE_LABEL[goal.scope] ?? goal.scope} ·{" "}
                      {MONTH_OPTIONS[goal.month - 1]?.label ?? goal.month}/
                      {goal.year}
                      {goal.updatedByName && <> · {goal.updatedByName}</>}
                    </p>
                  </div>
                  <Input
                    defaultValue={formatBrlAmountInput(goal.value)}
                    inputMode="decimal"
                    className="h-8 w-24 text-xs"
                    onBlur={(event) => {
                      const next = parseBrlAmount(event.target.value);
                      if (next !== null && next !== goal.value) {
                        updateGoal.mutate({ goalId: goal.id, value: next });
                      }
                    }}
                  />
                  <button
                    type="button"
                    title="Remover meta"
                    disabled={deleteGoal.isPending}
                    onClick={() => {
                      if (window.confirm(`Remover a meta "${goal.label}"?`)) {
                        deleteGoal.mutate({ goalId: goal.id });
                      }
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
