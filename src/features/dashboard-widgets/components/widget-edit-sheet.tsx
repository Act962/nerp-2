"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useMyDashboardWidgets,
  useUpdateDashboardWidget,
} from "../hooks/use-dashboard-widgets";
import { useWidgetCatalog } from "../hooks/use-widget-catalog";
import { oracleQueryConfigSchema } from "../lib/oracle-query-config";
import type { WidgetColor } from "../lib/pastel-colors";
import { readAlert } from "../lib/widget-alert";
import { readAppearance } from "../lib/widget-appearance";
import type { CustomizeState } from "./widget-customize-fields";
import { buildOptions, WidgetCustomizeFields } from "./widget-customize-fields";

// Shape universal do widget para o edit sheet — pessoal e org têm o mesmo
// esqueleto (options + layout + campos de exibição).
export interface WidgetEditRow {
  id: string;
  dataSourceKey: string;
  title: string | null;
  displayType: "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
  chartKind: "LINE" | "BAR" | "DONUT" | null;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  options: unknown;
}

export interface WidgetEditUpdateInput {
  widgetId: string;
  title: string | null;
  parentId: string | null;
  displayType: "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
  chartKind: "LINE" | "BAR" | "DONUT" | null;
  color: string | null;
  icon: string | null;
  options: Record<string, unknown> | null;
}

// Mesma decisão de assinatura mínima do picker — evita colisão de generics
// entre as duas mutations oRPC (pessoal vs. org).
export interface WidgetEditUpdateMutation {
  mutate: (
    input: WidgetEditUpdateInput,
    options?: { onSuccess?: () => void; onError?: (error: Error) => void },
  ) => void;
  isPending: boolean;
}

export interface WidgetEditDataSource {
  widgets: WidgetEditRow[];
  updateMutation: WidgetEditUpdateMutation;
}

// Wrapper padrão — dashboard PESSOAL. Preserva a API antiga (mesma
// assinatura, comportamento idêntico).
export function WidgetEditSheet({
  widgetId,
  onOpenChange,
}: {
  widgetId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: myWidgets } = useMyDashboardWidgets();
  const updateMutation = useUpdateDashboardWidget();
  return (
    <WidgetEditSheetCore
      widgetId={widgetId}
      onOpenChange={onOpenChange}
      dataSource={{
        widgets: (myWidgets?.widgets ?? []).map((widget) => ({
          id: widget.id,
          dataSourceKey: widget.dataSourceKey,
          title: widget.title,
          displayType: widget.displayType,
          chartKind: widget.chartKind,
          color: widget.color,
          icon: widget.icon,
          parentId: widget.parentId,
          options: widget.options,
        })),
        updateMutation,
      }}
    />
  );
}

/**
 * Core parametrizado. `WidgetEditSheet` (pessoal) e a versão da org
 * chamam este componente injetando as próprias mutações e a própria lista
 * de widgets.
 */
export function WidgetEditSheetCore({
  widgetId,
  onOpenChange,
  dataSource,
}: {
  widgetId: string | null;
  onOpenChange: (open: boolean) => void;
  dataSource: WidgetEditDataSource;
}) {
  const { data: catalog } = useWidgetCatalog();
  const updateWidget = dataSource.updateMutation;

  const widget = dataSource.widgets.find((item) => item.id === widgetId);
  const entry = catalog?.widgets.find(
    (item) => item.key === widget?.dataSourceKey,
  );

  const [state, setState] = useState<CustomizeState | null>(null);
  const [parentId, setParentId] = useState<string>("");

  const labelFor = (item: { title: string | null; dataSourceKey: string }) =>
    item.title ??
    catalog?.widgets.find((entry) => entry.key === item.dataSourceKey)?.label ??
    "Sem título";

  // Destinos possíveis: cards de topo, menos ele mesmo. Um card COM
  // desdobramentos não pode entrar em outro (empurraria os filhos para o
  // segundo nível), então nesse caso a lista fica vazia e o campo some.
  const temFilhos = dataSource.widgets.some(
    (item) => item.parentId === widgetId,
  );
  const parentOptions = temFilhos
    ? []
    : dataSource.widgets
        .filter((item) => !item.parentId && item.id !== widgetId)
        .map((item) => ({ id: item.id, label: labelFor(item) }));

  // Repopula sempre que abre um widget novo (ou o mesmo, de novo) — não dá
  // pra derivar direto no render porque o usuário edita `state` localmente.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só deve rodar quando o widget/entry alvo mudam, não a cada render do estado local
  useEffect(() => {
    if (!widget || !entry) {
      setState(null);
      return;
    }
    const options = widget.options as {
      targetValue?: unknown;
      oracle?: unknown;
    } | null;
    const oracle = oracleQueryConfigSchema.safeParse(options?.oracle);
    setState({
      displayType: widget.displayType,
      chartKind: widget.chartKind ?? entry.supportedChartKinds[0] ?? "LINE",
      color: widget.color as WidgetColor | null,
      icon: widget.icon,
      targetValue:
        typeof options?.targetValue === "number"
          ? String(options.targetValue)
          : "",
      title: widget.title ?? "",
      oracle: oracle.success ? oracle.data : null,
      appearance: readAppearance(widget.options),
      alert: readAlert(widget.options),
    });
    setParentId(widget.parentId ?? "");
  }, [widget?.id, entry?.key]);

  if (!widgetId || !widget || !entry || !state) {
    return null;
  }

  const targetValue = Number(state.targetValue.replace(",", "."));

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Personalizar widget</SheetTitle>
          <SheetDescription>{entry.label}</SheetDescription>
        </SheetHeader>
        {/* `min-h-0 flex-1` é o que faz a rolagem existir: sem isso o filho
          encolhe dentro do SheetContent (flex column de altura fixa) e o
          conteúdo alto do montador Oracle empurra o rodapé para fora da tela. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {(parentOptions.length > 0 || widget.parentId) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">Onde</Label>
              <Select
                value={parentId || "root"}
                onValueChange={(value) =>
                  setParentId(value === "root" ? "" : value)
                }
              >
                <SelectTrigger className="h-7 w-56 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    No dashboard (card próprio)
                  </SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      Dentro de “{option.label}”
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {temFilhos && (
            <p className="text-[10px] text-muted-foreground">
              Este widget tem desdobramentos, então não pode ser colocado dentro
              de outro.
            </p>
          )}
          <WidgetCustomizeFields
            entry={entry}
            state={state}
            onChange={(next) =>
              setState((current) =>
                current ? { ...current, ...next } : current,
              )
            }
          />
        </div>
        <SheetFooter className="shrink-0 border-t">
          <Button
            type="button"
            disabled={updateWidget.isPending}
            onClick={() => {
              updateWidget.mutate(
                {
                  widgetId: widget.id,
                  // null limpa o nome e volta ao rótulo padrão da fonte.
                  title: state.title.trim() || null,
                  parentId: parentId || null,
                  displayType: state.displayType,
                  chartKind:
                    state.displayType === "CHART" ? state.chartKind : null,
                  color: state.color,
                  icon: state.icon,
                  options: buildOptions(state, targetValue),
                },
                { onSuccess: () => onOpenChange(false) },
              );
            }}
          >
            {updateWidget.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
