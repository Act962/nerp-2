"use client";

import { useMemo, useState } from "react";
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
  evaluateAlerts,
  readAlerts,
} from "@/features/dashboard-widgets/lib/widget-alert";
import {
  augmentReportTable,
  readReportConfig,
  type ReportGoalScope,
} from "@/features/dashboard-widgets/lib/report-table";
import { panelStyles, readPanelAppearance } from "../lib/panel-appearance";
import {
  ORG_PANEL_DRAG_HANDLE,
  type OrgGridWidget,
  type OrgLayoutSaveItem,
  OrgWidgetGrid,
  panelDefaultItem,
} from "./org-widget-grid";
import { BoardTabs, type BoardSummary } from "./board-tabs";

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
  boardId?: string | null;
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
  boards,
  values,
  isLoading,
  emptyState,
  labelFallback,
  canEdit = false,
  goalsByScope,
  onSaveLayout,
  onSavePanelLayout,
  onEditWidget,
  onRemoveWidget,
  onOpenDetail,
  onAddBoard,
  onRenameBoard,
  onRemoveBoard,
  onReorderBoards,
}: {
  widgets: OrgWidgetSummary[];
  panels?: OrgPanelSummary[];
  boards?: BoardSummary[];
  values: OrgWidgetValueEntry[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  labelFallback?: (dataSourceKey: string) => string;
  canEdit?: boolean;
  goalsByScope?: Map<ReportGoalScope, Map<string, number>>;
  onSaveLayout?: (items: OrgLayoutSaveItem[]) => void;
  onSavePanelLayout?: (items: OrgLayoutSaveItem[]) => void;
  onEditWidget?: (widgetId: string) => void;
  onRemoveWidget?: (widgetId: string) => void;
  onOpenDetail?: (widgetId: string) => void;
  onAddBoard?: (title: string) => void;
  onRenameBoard?: (boardId: string, title: string) => void;
  onRemoveBoard?: (boardId: string) => void;
  onReorderBoards?: (boardIds: string[]) => void;
}) {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const sortedBoards = useMemo(
    () => [...(boards ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [boards],
  );

  const valueById = useMemo(
    () => new Map(values.map((entry) => [entry.widgetId, entry])),
    [values],
  );

  // Widgets topo × filhos: o pai renderiza o próprio + a lista de filhos
  // dentro dele. Espelha o padrão do DashboardGrid pessoal.
  const topWidgets = useMemo(
    () => widgets.filter((widget) => !widget.parentId),
    [widgets],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, OrgWidgetSummary[]>();
    for (const widget of widgets) {
      if (!widget.parentId) continue;
      const list = map.get(widget.parentId) ?? [];
      list.push(widget);
      map.set(widget.parentId, list);
    }
    return map;
  }, [widgets]);

  const widgetById = useMemo(
    () => new Map(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );

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
    const goalsByCode = reportConfig?.goalScope
      ? goalsByScope?.get(reportConfig.goalScope)
      : undefined;
    const value = entry?.value;
    const opts = widget.options as { targetValue?: number } | null;
    const targetValue =
      typeof opts?.targetValue === "number" ? opts.targetValue : null;
    const widgetAlerts = readAlerts(widget.options);
    const isTable = widget.displayType === "TABLE";
    const alertResult = isTable
      ? { active: false, color: null, message: null }
      : evaluateAlerts(widgetAlerts, value, targetValue);
    return (
      <div className="h-full">
        <WidgetFrame
          title={label}
          titleAlign={appearance.titleAlign}
          titleColor={appearance.titleColor}
          titleSize={appearance.titleSize}
          titleWeight={appearance.titleWeight}
          color={widget.color}
          alertColor={alertResult.active ? alertResult.color : null}
          alertMessage={alertResult.active ? alertResult.message : null}
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
                reportConfig
                  ? augmentReportTable(value, reportConfig, goalsByCode)
                  : value
              }
              alerts={widgetAlerts.length > 0 ? widgetAlerts : undefined}
              targetValue={targetValue}
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

  const { byPanel, loose } = useMemo(() => {
    const bp = new Map<string, OrgWidgetSummary[]>();
    const lo: OrgWidgetSummary[] = [];
    for (const widget of topWidgets) {
      if (widget.panelId) {
        const list = bp.get(widget.panelId) ?? [];
        list.push(widget);
        bp.set(widget.panelId, list);
      } else {
        lo.push(widget);
      }
    }
    return { byPanel: bp, loose: lo };
  }, [topWidgets]);

  const panelsWithWidgets = useMemo(() => {
    const sorted = [...(panels ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    return sorted.filter((panel) => (byPanel.get(panel.id)?.length ?? 0) > 0);
  }, [panels, byPanel]);

  const visiblePanels = useMemo(
    () =>
      selectedBoardId === null
        ? panelsWithWidgets
        : panelsWithWidgets.filter((p) => p.boardId === selectedBoardId),
    [panelsWithWidgets, selectedBoardId],
  );

  const panelGridWidgets = useMemo<OrgGridWidget[]>(
    () =>
      visiblePanels.map((panel, index) => ({
        id: panel.id,
        layout: selectedBoardId === null ? (panel.layout ?? null) : null,
        sortOrder: selectedBoardId === null ? panel.sortOrder : index,
      })),
    [visiblePanels, selectedBoardId],
  );

  const panelWidgetGridItems = useMemo(() => {
    const map = new Map<string, OrgGridWidget[]>();
    for (const [panelId, panelWidgets] of byPanel) {
      map.set(
        panelId,
        panelWidgets.map((w) => ({
          id: w.id,
          layout: w.layout ?? null,
          sortOrder: w.sortOrder ?? 0,
        })),
      );
    }
    return map;
  }, [byPanel]);

  const looseGridWidgets = useMemo<OrgGridWidget[]>(
    () =>
      loose.map((w) => ({
        id: w.id,
        layout: w.layout ?? null,
        sortOrder: w.sortOrder ?? 0,
      })),
    [loose],
  );

  const topGridWidgets = useMemo<OrgGridWidget[]>(
    () =>
      topWidgets.map((w) => ({
        id: w.id,
        layout: w.layout ?? null,
        sortOrder: w.sortOrder ?? 0,
      })),
    [topWidgets],
  );

  const panelById = useMemo(
    () => new Map(panelsWithWidgets.map((panel) => [panel.id, panel])),
    [panelsWithWidgets],
  );

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

  const renderPanelSection = (panelId: string) => {
    const panel = panelById.get(panelId);
    if (!panel) return null;
    const innerWidgets = panelWidgetGridItems.get(panel.id);
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
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4"
          style={{ scrollbarGutter: "stable" }}
        >
          {innerWidgets && innerWidgets.length > 0 && (
            <OrgWidgetGrid
              widgets={innerWidgets}
              editable={canEdit}
              onSaveLayout={onSaveLayout}
              dragHandleClass={WIDGET_DRAG_HANDLE_CLASS}
              renderItem={renderWidget}
              breakpoints={PANEL_WIDGET_BREAKPOINTS}
            />
          )}
        </div>
      </section>
    );
  };

  if (panelsWithWidgets.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {sortedBoards.length > 0 && (
          <BoardTabs
            boards={sortedBoards}
            selectedBoardId={selectedBoardId}
            onSelect={setSelectedBoardId}
            editable={canEdit}
            onAdd={onAddBoard}
            onRename={onRenameBoard}
            onRemove={onRemoveBoard}
            onReorder={onReorderBoards}
          />
        )}
        <OrgWidgetGrid
          widgets={topGridWidgets}
          editable={canEdit}
          onSaveLayout={onSaveLayout}
          dragHandleClass={WIDGET_DRAG_HANDLE_CLASS}
          renderItem={renderWidget}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(sortedBoards.length > 0 || canEdit) && (
        <BoardTabs
          boards={sortedBoards}
          selectedBoardId={selectedBoardId}
          onSelect={setSelectedBoardId}
          editable={canEdit}
          onAdd={onAddBoard}
          onRename={onRenameBoard}
          onRemove={onRemoveBoard}
          onReorder={onReorderBoards}
        />
      )}

      <OrgWidgetGrid
        widgets={panelGridWidgets}
        editable={canEdit}
        onSaveLayout={onSavePanelLayout}
        dragHandleClass={ORG_PANEL_DRAG_HANDLE}
        defaultItem={panelDefaultItem}
        renderItem={renderPanelSection}
      />

      {selectedBoardId === null && looseGridWidgets.length > 0 && (
        <OrgWidgetGrid
          widgets={looseGridWidgets}
          editable={canEdit}
          onSaveLayout={onSaveLayout}
          dragHandleClass={WIDGET_DRAG_HANDLE_CLASS}
          renderItem={renderWidget}
        />
      )}
    </div>
  );
}
