"use client";

import { GripVertical } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetChildren } from "@/features/dashboard-widgets/components/widget-children";
import {
  WIDGET_DRAG_HANDLE_CLASS,
  WidgetFrame,
} from "@/features/dashboard-widgets/components/widget-frame";
import { ChartWidget } from "@/features/dashboard-widgets/components/widgets/chart-widget";
import { FeedWidget } from "@/features/dashboard-widgets/components/widgets/feed-widget";
import { FleetWidget } from "@/features/dashboard-widgets/components/widgets/fleet-widget";
import { ListWidget } from "@/features/dashboard-widgets/components/widgets/list-widget";
import { MapWidget } from "@/features/dashboard-widgets/components/widgets/map-widget";
import { StatWidget } from "@/features/dashboard-widgets/components/widgets/stat-widget";
import { TableWidget } from "@/features/dashboard-widgets/components/widgets/table-widget";
import { PANEL_WIDGET_BREAKPOINTS } from "@/features/dashboard-widgets/lib/grid-breakpoints";
import { readAppearance } from "@/features/dashboard-widgets/lib/widget-appearance";
import type { WidgetValue } from "@/features/dashboard-widgets/lib/widget-value";
import {
  augmentReportTable,
  readReportConfig,
} from "@/features/dashboard-widgets/lib/report-table";
import { panelStyles, readPanelAppearance } from "../lib/panel-appearance";
import {
  ORG_PANEL_DRAG_HANDLE,
  type OrgLayoutSaveItem,
  OrgWidgetGrid,
  panelDefaultItem,
} from "./org-widget-grid";

/** Lê `options.sparkline` de qualquer forma (o resolver não devolve isso). */
function readSparkline(options: unknown): number[] | undefined {
  const value = (options as { sparkline?: unknown } | null)?.sparkline;
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (item): item is number => typeof item === "number",
  );
  return filtered.length >= 2 ? filtered : undefined;
}

// Renderização SOMENTE-LEITURA do dashboard da organização. Usada tanto pela
// aba "Da organização" (que o membro logado consome) quanto pela rota
// pública (sem login). Sem drag/drop, sem "personalizar", sem picker —
// isso vive só no editor admin (`/dashboard-organizacao`).
//
// O grid é responsivo simples (CSS grid + colspan), NÃO o react-grid-layout
// pesado do dashboard pessoal, porque:
//   - somente-leitura não precisa de handles nem resize;
//   - a rota pública é mostrada em telão/monitor de sala; layout simples
//     evita bug estranho de largura em iframe/embed.
// Se no futuro precisar posicionamento livre no read-only, migramos o grid.

export interface OrgWidgetSummary {
  id: string;
  dataSourceKey: string;
  title: string | null;
  displayType: "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
  chartKind: "LINE" | "BAR" | "DONUT" | null;
  color: string | null;
  icon: string | null;
  options: unknown;
  parentId: string | null;
  panelId?: string | null;
  /** {lg,md,sm} salvos no editor — respeitados aqui (só-leitura). */
  layout?: unknown;
  sortOrder?: number;
}

export interface OrgPanelSummary {
  id: string;
  title: string;
  color: string | null;
  sortOrder: number;
  appearance?: unknown;
  layout?: unknown;
}

export interface OrgWidgetValueEntry {
  widgetId: string;
  value: WidgetValue | null;
  progressPercent: number | undefined;
  error: string | null;
}

export function OrgDashboardView({
  widgets,
  panels,
  values,
  isLoading,
  emptyState,
  labelFallback,
  canEdit = false,
  onSaveLayout,
  onSavePanelLayout,
  onEditWidget,
  onRemoveWidget,
  onOpenDetail,
}: {
  widgets: OrgWidgetSummary[];
  /** Painéis (grupos visuais). Ausente/vazio = render em grade única (legado). */
  panels?: OrgPanelSummary[];
  values: OrgWidgetValueEntry[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  /** Rótulo padrão quando o widget não tem `title` — evita "Widget" cru. */
  labelFallback?: (dataSourceKey: string) => string;
  /** Admin: liga redimensionar/arrastar/editar/remover (edita o modelo
   * compartilhado). Membro comum e link público ficam só-leitura. */
  canEdit?: boolean;
  onSaveLayout?: (items: OrgLayoutSaveItem[]) => void;
  /** Persiste posição/tamanho DOS PAINÉIS (grade externa). */
  onSavePanelLayout?: (items: OrgLayoutSaveItem[]) => void;
  onEditWidget?: (widgetId: string) => void;
  onRemoveWidget?: (widgetId: string) => void;
  /** Clique no corpo abre o detalhamento — disponível para todos. */
  onOpenDetail?: (widgetId: string) => void;
}) {
  const valueById = new Map(values.map((entry) => [entry.widgetId, entry]));

  // Widgets topo × filhos: o pai renderiza o próprio + a lista de filhos
  // dentro dele. Espelha o padrão do DashboardGrid pessoal.
  const topWidgets = widgets.filter((widget) => !widget.parentId);
  const childrenByParent = new Map<string, OrgWidgetSummary[]>();
  for (const widget of widgets) {
    if (!widget.parentId) continue;
    const list = childrenByParent.get(widget.parentId) ?? [];
    list.push(widget);
    childrenByParent.set(widget.parentId, list);
  }

  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));

  // Um card de widget (o pai + seus filhos). `h-full` para preencher a célula
  // do RGL (que respeita o layout salvo no editor).
  const renderWidget = (widgetId: string) => {
    const widget = widgetById.get(widgetId);
    if (!widget) return null;
    const entry = valueById.get(widget.id);
    const label =
      widget.title ?? labelFallback?.(widget.dataSourceKey) ?? "Widget";
    const appearance = readAppearance(widget.options);
    // Colunas derivadas (% part./acum., contrib., % lucro) para widgets-
    // relatório — só quando `options.report` está presente.
    const reportConfig = readReportConfig(widget.options);
    const value = entry?.value;
    return (
      <div className="h-full">
        <WidgetFrame
          title={label}
          titleAlign={appearance.titleAlign}
          titleColor={appearance.titleColor}
          titleSize={appearance.titleSize}
          titleWeight={appearance.titleWeight}
          color={widget.color}
          background={appearance.background}
          border={appearance.border}
          borderColor={appearance.borderColor}
          draggable={canEdit}
          editable={canEdit}
          onEdit={
            canEdit && onEditWidget ? () => onEditWidget(widget.id) : undefined
          }
          onRemove={
            canEdit && onRemoveWidget
              ? () => onRemoveWidget(widget.id)
              : undefined
          }
          onOpenDetail={
            onOpenDetail && value ? () => onOpenDetail(widget.id) : undefined
          }
        >
          {value === undefined || value === null ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              {entry?.error ?? "Sem dado."}
            </p>
          ) : value.kind === "STAT" ? (
            <StatWidget
              value={value}
              icon={widget.icon}
              progressPercent={entry?.progressPercent}
              valueAlign={appearance.valueAlign}
              valueColor={appearance.valueColor}
              valueSize={appearance.valueSize}
              valueWeight={appearance.valueWeight}
              iconColor={appearance.iconColor}
              sparkline={readSparkline(widget.options)}
            />
          ) : value.kind === "CHART" ? (
            <ChartWidget value={value} chartKind={widget.chartKind} />
          ) : value.kind === "MAP" ? (
            <MapWidget value={value} />
          ) : value.kind === "TABLE" ? (
            <TableWidget
              value={
                reportConfig ? augmentReportTable(value, reportConfig) : value
              }
            />
          ) : value.kind === "FLEET" ? (
            <FleetWidget value={value} />
          ) : value.kind === "FEED" ? (
            <FeedWidget value={value} />
          ) : (
            <ListWidget value={value} />
          )}

          <WidgetChildren
            items={(childrenByParent.get(widget.id) ?? []).map((child) => {
              const childEntry = valueById.get(child.id);
              return {
                id: child.id,
                title:
                  child.title ??
                  labelFallback?.(child.dataSourceKey) ??
                  "Widget",
                icon: child.icon,
                value: childEntry?.value,
                error: childEntry?.error,
              };
            })}
          />
        </WidgetFrame>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (topWidgets.length === 0) {
    return (
      emptyState ?? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Nenhum widget disponível.
        </div>
      )
    );
  }

  // Agrupa por painel. Widgets sem painel caem num grupo "solto" no fim.
  const byPanel = new Map<string, OrgWidgetSummary[]>();
  const loose: OrgWidgetSummary[] = [];
  for (const widget of topWidgets) {
    if (widget.panelId) {
      const list = byPanel.get(widget.panelId) ?? [];
      list.push(widget);
      byPanel.set(widget.panelId, list);
    } else {
      loose.push(widget);
    }
  }
  const sortedPanels = [...(panels ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const panelsWithWidgets = sortedPanels.filter(
    (panel) => (byPanel.get(panel.id)?.length ?? 0) > 0,
  );

  const toGridWidgets = (list: OrgWidgetSummary[]) =>
    list.map((widget) => ({
      id: widget.id,
      layout: widget.layout ?? null,
      sortOrder: widget.sortOrder ?? 0,
    }));

  // Grade de um escopo. Admin (`canEdit`) ganha arrastar/redimensionar +
  // persistência; a alça é o cabeçalho do WidgetFrame. `nested=true` (widgets
  // DENTRO de um painel) usa breakpoints calibrados pro container do painel,
  // não da página inteira — sem isso o grid interno cai sempre no breakpoint
  // mais estreito e os widgets nunca ficam lado a lado.
  const renderGrid = (list: OrgWidgetSummary[], nested = false) => (
    <OrgWidgetGrid
      widgets={toGridWidgets(list)}
      editable={canEdit}
      onSaveLayout={onSaveLayout}
      dragHandleClass={WIDGET_DRAG_HANDLE_CLASS}
      renderItem={renderWidget}
      breakpoints={nested ? PANEL_WIDGET_BREAKPOINTS : undefined}
    />
  );

  // Sem painéis com conteúdo → grade única (comportamento legado).
  if (panelsWithWidgets.length === 0) {
    return renderGrid(topWidgets);
  }

  const panelById = new Map(
    panelsWithWidgets.map((panel) => [panel.id, panel]),
  );

  // Cada painel é um item da grade externa (redimensionável pela alça no canto,
  // arrastável pelo cabeçalho quando admin). `h-full` para preencher a célula;
  // o corpo rola se o conteúdo passar da altura do painel.
  const renderPanelSection = (panelId: string) => {
    const panel = panelById.get(panelId);
    if (!panel) return null;
    const ps = panelStyles(panel.color, readPanelAppearance(panel.appearance));
    return (
      <section
        className={`flex h-full flex-col overflow-hidden rounded-xl ${
          ps.noBorder ? "" : "border"
        }`}
        style={ps.sectionStyle}
      >
        <div
          className={`flex items-center gap-2 px-4 py-2 ${ORG_PANEL_DRAG_HANDLE} ${
            canEdit ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          style={ps.headerStyle}
        >
          {canEdit && (
            <GripVertical className="size-4 shrink-0" style={ps.titleStyle} />
          )}
          <span className={`truncate ${ps.titleClass}`} style={ps.titleStyle}>
            {panel.title}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {renderGrid(byPanel.get(panel.id) ?? [], true)}
        </div>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <OrgWidgetGrid
        widgets={panelsWithWidgets.map((panel) => ({
          id: panel.id,
          layout: panel.layout ?? null,
          sortOrder: panel.sortOrder,
        }))}
        editable={canEdit}
        onSaveLayout={onSavePanelLayout}
        dragHandleClass={ORG_PANEL_DRAG_HANDLE}
        defaultItem={panelDefaultItem}
        renderItem={renderPanelSection}
      />

      {loose.length > 0 && renderGrid(loose)}
    </div>
  );
}
