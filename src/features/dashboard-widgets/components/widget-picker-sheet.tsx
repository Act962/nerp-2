"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useAddDashboardWidget,
  useMyDashboardWidgets,
} from "../hooks/use-dashboard-widgets";
import { useWidgetCatalog } from "../hooks/use-widget-catalog";
import { describeOracleQuery } from "../lib/oracle-query-config";
import {
  buildOptions,
  type ChartKind,
  type CustomizeState,
  type DisplayType,
  WidgetCustomizeFields,
} from "./widget-customize-fields";

const CATEGORY_TABS = [
  { value: "native", label: "Nativo" },
  { value: "ranking", label: "Ranking" },
  { value: "erp", label: "ERP" },
  { value: "oracle", label: "Oracle" },
  { value: "geo", label: "Mapas" },
  { value: "manual", label: "Manual" },
] as const;

interface CatalogEntry {
  key: string;
  category: string;
  label: string;
  description: string | null;
  supportedDisplayTypes: DisplayType[];
  supportedChartKinds: ChartKind[];
  requiresErp: boolean;
  available: boolean;
}

function WidgetCatalogRow({
  entry,
  addedCount,
  parents,
}: {
  entry: CatalogEntry;
  addedCount: number;
  /** Cards de topo que podem receber este widget como desdobramento. */
  parents: { id: string; label: string }[];
}) {
  const addWidget = useAddDashboardWidget();
  const [state, setState] = useState<CustomizeState>({
    displayType: entry.supportedDisplayTypes[0],
    chartKind: entry.supportedChartKinds[0] ?? "LINE",
    color: null,
    icon: null,
    targetValue: "",
    title: "",
    oracle: null,
  });
  const [parentId, setParentId] = useState<string>("");

  const targetValue = Number(state.targetValue.replace(",", "."));

  const row = (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{entry.label}</p>
          {entry.description && (
            <p className="text-xs text-muted-foreground">{entry.description}</p>
          )}
        </div>
        {addedCount > 0 && (
          <Badge
            variant="secondary"
            className="shrink-0 gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-3" />
            {addedCount > 1 ? `Adicionado (${addedCount}x)` : "Adicionado"}
          </Badge>
        )}
      </div>
      <WidgetCustomizeFields
        entry={entry}
        state={state}
        onChange={(next) => setState((current) => ({ ...current, ...next }))}
      />
      {/* Fixo na base do card: o montador do Oracle é longo e o botão ficava
        escondido no fim de tudo — o usuário não achava como adicionar. */}
      {parents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground">Onde</Label>
          <Select
            value={parentId || "root"}
            onValueChange={(value) =>
              setParentId(value === "root" ? "" : value)
            }
          >
            <SelectTrigger className="h-7 w-52 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">No dashboard (card próprio)</SelectItem>
              {parents.map((parent) => (
                <SelectItem key={parent.id} value={parent.id}>
                  Dentro de “{parent.label}”
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="sticky bottom-0 -mx-3 -mb-3 mt-1 rounded-b-md border-t bg-background/95 px-3 py-2 backdrop-blur">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={!entry.available || addWidget.isPending}
          onClick={() =>
            addWidget.mutate({
              dataSourceKey: entry.key,
              // Sem nome digitado, deixa o servidor guardar null e a grade cai
              // no rótulo padrão — mas numa consulta Oracle o resumo da própria
              // consulta é bem mais útil que "Consulta personalizada".
              title:
                state.title.trim() ||
                (state.oracle ? describeOracleQuery(state.oracle) : null),
              displayType: state.displayType,
              chartKind:
                state.displayType === "CHART" ? state.chartKind : undefined,
              color: state.color,
              icon: state.icon,
              parentId: parentId || null,
              options: buildOptions(state, targetValue),
            })
          }
        >
          {addWidget.isPending && <Loader2 className="size-3 animate-spin" />}
          Adicionar
        </Button>
      </div>
    </div>
  );

  if (entry.available) return row;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="opacity-50">{row}</div>
      </TooltipTrigger>
      <TooltipContent>
        Esta organização não tem uma conexão de ERP ativa.
      </TooltipContent>
    </Tooltip>
  );
}

export function WidgetPickerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useWidgetCatalog();
  const { data: myWidgets } = useMyDashboardWidgets();
  const entries = (data?.widgets ?? []) as CatalogEntry[];

  const addedCountByKey = new Map<string, number>();
  for (const widget of myWidgets?.widgets ?? []) {
    addedCountByKey.set(
      widget.dataSourceKey,
      (addedCountByKey.get(widget.dataSourceKey) ?? 0) + 1,
    );
  }

  const labelByKey = new Map(entries.map((entry) => [entry.key, entry.label]));
  // Só card de topo pode receber desdobramento — aninhar é de um nível só.
  const parentOptions = (myWidgets?.widgets ?? [])
    .filter((widget) => !widget.parentId)
    .map((widget) => ({
      id: widget.id,
      label:
        widget.title ?? labelByKey.get(widget.dataSourceKey) ?? "Sem título",
    }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Adicionar widget</SheetTitle>
          <SheetDescription>
            Escolha uma fonte de dado, como exibir — número, gráfico ou lista —
            e uma cor pastel opcional.
          </SheetDescription>
        </SheetHeader>

        {/* A rolagem precisa ficar NESTE elemento, não no SheetContent: ele é
          `flex flex-col` de altura fixa, então um filho sem `min-h-0` encolhe
          em vez de transbordar e o pai nunca ganha barra de rolagem — o fim do
          conteúdo (o botão "Adicionar") ficava inalcançável com o montador do
          Oracle, que é alto. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Tabs defaultValue="native">
              <TabsList className="w-full">
                {CATEGORY_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CATEGORY_TABS.map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className="mt-3 flex flex-col gap-2"
                >
                  {entries
                    .filter((entry) => entry.category === tab.value)
                    .map((entry) => (
                      <WidgetCatalogRow
                        key={entry.key}
                        entry={entry}
                        addedCount={addedCountByKey.get(entry.key) ?? 0}
                        parents={parentOptions}
                      />
                    ))}
                  {entries.filter((entry) => entry.category === tab.value)
                    .length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {tab.value === "manual"
                        ? "Nenhuma métrica manual criada ainda."
                        : "Nada disponível nesta categoria."}
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
