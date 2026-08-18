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
  useCreateManualMetric,
  useDeleteManualMetric,
  useManualMetrics,
  useUpdateManualMetric,
} from "../hooks/use-manual-metrics";

const UNIT_OPTIONS = [
  { value: "currency", label: "Moeda (R$)" },
  { value: "number", label: "Número" },
  { value: "percent", label: "Porcentagem (%)" },
] as const;

export function ManualMetricsAdmin({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useManualMetrics();
  const createMetric = useCreateManualMetric();
  const updateMetric = useUpdateManualMetric();
  const deleteMetric = useDeleteManualMetric();

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"currency" | "number" | "percent">("number");

  const handleCreate = () => {
    const numericValue = parseBrlAmount(value);
    if (!label.trim() || numericValue === null) {
      toast.error("Informe rótulo e valor corretamente.");
      return;
    }
    createMetric.mutate(
      { label: label.trim(), value: numericValue, unit },
      {
        onSuccess: () => {
          setLabel("");
          setValue("");
          setUnit("number");
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Métricas manuais</SheetTitle>
          <SheetDescription>
            Um rótulo e um valor que você digita e atualiza quando quiser — fica
            disponível como widget pra qualquer membro da organização.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label className="text-xs">Rótulo</Label>
              <Input
                placeholder="Ex: Meta da diretoria"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs">Valor</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs">Unidade</Label>
              <Select
                value={unit}
                onValueChange={(next) =>
                  setUnit(next as "currency" | "number" | "percent")
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              disabled={createMetric.isPending}
              onClick={handleCreate}
            >
              <Plus className="size-3.5" /> Criar
            </Button>
          </div>

          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (data?.metrics ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma métrica manual ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {(data?.metrics ?? []).map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {metric.label}
                    </p>
                    {metric.updatedByName && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        Atualizado por {metric.updatedByName}
                      </p>
                    )}
                  </div>
                  <Input
                    defaultValue={formatBrlAmountInput(metric.value)}
                    inputMode="decimal"
                    className="h-8 w-24 text-xs"
                    onBlur={(event) => {
                      const next = parseBrlAmount(event.target.value);
                      if (next !== null && next !== metric.value) {
                        updateMetric.mutate({
                          metricId: metric.id,
                          value: next,
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    title="Remover métrica"
                    disabled={deleteMetric.isPending}
                    onClick={() => {
                      if (
                        window.confirm(`Remover a métrica "${metric.label}"?`)
                      ) {
                        deleteMetric.mutate({ metricId: metric.id });
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
