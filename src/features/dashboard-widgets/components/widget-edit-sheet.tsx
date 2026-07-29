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
import type { PastelColorKey } from "../lib/pastel-colors";
import type { CustomizeState } from "./widget-customize-fields";
import { buildOptions, WidgetCustomizeFields } from "./widget-customize-fields";

export function WidgetEditSheet({
  widgetId,
  onOpenChange,
}: {
  widgetId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: myWidgets } = useMyDashboardWidgets();
  const { data: catalog } = useWidgetCatalog();
  const updateWidget = useUpdateDashboardWidget();

  const widget = myWidgets?.widgets.find((item) => item.id === widgetId);
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
  const temFilhos = (myWidgets?.widgets ?? []).some(
    (item) => item.parentId === widgetId,
  );
  const parentOptions = temFilhos
    ? []
    : (myWidgets?.widgets ?? [])
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
      color: widget.color as PastelColorKey | null,
      icon: widget.icon,
      targetValue:
        typeof options?.targetValue === "number"
          ? String(options.targetValue)
          : "",
      title: widget.title ?? "",
      oracle: oracle.success ? oracle.data : null,
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
