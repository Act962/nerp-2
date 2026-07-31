"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, Maximize2, Minimize2, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardGrid } from "@/features/dashboard-widgets/components/dashboard-grid";
import { ManualMetricsAdmin } from "@/features/dashboard-widgets/components/manual-metrics-admin";
import { SalesGoalsAdmin } from "@/features/dashboard-widgets/components/sales-goals-admin";
import { WidgetDetailDialog } from "@/features/dashboard-widgets/components/widget-detail-dialog";
import { WidgetEditSheetCore } from "@/features/dashboard-widgets/components/widget-edit-sheet";
import { WidgetPickerSheet } from "@/features/dashboard-widgets/components/widget-picker-sheet";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { OrgDashboardView } from "@/features/org-dashboard/components/org-dashboard-view";
import { buildGoalsByScope } from "@/features/dashboard-widgets/lib/report-table";
import { useSalesGoals } from "@/features/dashboard-widgets/hooks/use-sales-goals";
import {
  useOrgDashboard,
  useOrgDashboardValues,
  useRemoveOrgWidget,
  useSaveOrgLayout,
  useSaveOrgPanelLayout,
  useUpdateOrgWidget,
} from "@/features/org-dashboard/hooks/use-org-dashboard";
import { hasFullAccess } from "@/lib/permissions";
import { DashboardShortcuts } from "./dashboard-shortcuts";

export default function DashboardPage() {
  const { member } = useCurrentMember();
  const isAdmin = hasFullAccess(member?.role);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const now = new Date();
  const panelRef = useRef<HTMLDivElement>(null);

  // Mesmo padrão do "Modo TV" do ranking: Fullscreen API de verdade, com
  // fallback visual (fixed inset-0) se o navegador negar (ex.: dentro de um
  // iframe sem permissão).
  useEffect(() => {
    const handleFullscreenChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await panelRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreen((current) => !current);
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className={cn(
        fullscreen
          ? "fixed inset-0 z-[60] overflow-y-auto bg-background p-6"
          : "space-y-6",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3",
          fullscreen && "mb-6",
        )}
      >
        <PageHeader
          title="Dashboard"
          description="Visão geral do seu negócio"
        />
        <div className="flex flex-wrap gap-2">
          {!fullscreen && isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMetricsOpen(true)}
            >
              <ListChecks className="size-4" /> Métricas manuais
            </Button>
          )}
          {!fullscreen && isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setGoalsOpen(true)}
            >
              <Target className="size-4" /> Metas de vendas
            </Button>
          )}
          {!fullscreen && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-4" /> Adicionar widget
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="size-4" /> Sair da tela cheia
              </>
            ) : (
              <>
                <Maximize2 className="size-4" /> Tela cheia
              </>
            )}
          </Button>
        </div>
      </div>

      {!fullscreen && <DashboardShortcuts />}

      <DashboardTabs fullscreen={fullscreen} />

      <WidgetPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
      {isAdmin && (
        <ManualMetricsAdmin open={metricsOpen} onOpenChange={setMetricsOpen} />
      )}
      {isAdmin && (
        <SalesGoalsAdmin
          open={goalsOpen}
          onOpenChange={setGoalsOpen}
          defaultYear={now.getFullYear()}
          defaultMonth={now.getMonth() + 1}
        />
      )}
    </div>
  );
}

// Duas abas: o dashboard pessoal (sempre existe) e o "Da organização"
// (aparece SÓ quando o membro tem pelo menos um widget visível — a resposta
// da API já vem filtrada, então basta contar). Não usa tabs quando a org
// não expôs nada: o dashboard pessoal fica direto.
function DashboardTabs({ fullscreen }: { fullscreen: boolean }) {
  const { data } = useOrgDashboard();
  const widgets = data?.widgets ?? [];
  const panels = data?.panels ?? [];
  const hasOrgTab = widgets.length > 0;

  if (!hasOrgTab) {
    return (
      <DashboardGrid
        // key força remontar ao entrar/sair da tela cheia — o hook de
        // largura do react-grid-layout mede via ResizeObserver no mount, e
        // a transição de tela cheia (Fullscreen API ou fallback fixed) podia
        // deixar a largura medida presa no valor de antes da troca.
        key={fullscreen ? "fullscreen" : "normal"}
        fullscreen={fullscreen}
      />
    );
  }

  return (
    <Tabs defaultValue="my">
      <TabsList>
        <TabsTrigger value="my">Meu dashboard</TabsTrigger>
        <TabsTrigger value="org">Da organização</TabsTrigger>
      </TabsList>
      <TabsContent value="my" className="mt-4">
        <DashboardGrid
          key={fullscreen ? "fullscreen" : "normal"}
          fullscreen={fullscreen}
        />
      </TabsContent>
      <TabsContent value="org" className="mt-4">
        <OrgDashboardTab
          // Mesmo truque do DashboardGrid: força remount ao entrar/sair da
          // tela cheia — o hook de largura do react-grid-layout (usado nos
          // grids de painel/widget da org) mede via ResizeObserver no mount, e
          // a transição de tela cheia podia deixar a largura presa no valor
          // de antes da troca.
          key={fullscreen ? "fullscreen" : "normal"}
          widgets={widgets}
          panels={panels}
          canEdit={data?.canEdit ?? false}
          fullscreen={fullscreen}
        />
      </TabsContent>
    </Tabs>
  );
}

interface OrgTabWidget {
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
  layout?: unknown;
  sortOrder?: number;
}

function OrgDashboardTab({
  widgets,
  panels,
  canEdit,
  fullscreen = false,
}: {
  widgets: OrgTabWidget[];
  panels: Array<{
    id: string;
    title: string;
    color: string | null;
    sortOrder: number;
    appearance?: unknown;
    layout?: unknown;
  }>;
  /** Admin: liga os mesmos recursos do "Meu dashboard" (esticar, arrastar,
   * personalizar, remover). Edita o modelo COMPARTILHADO da org. */
  canEdit: boolean;
  /** Modo TV (fullscreen): apresentação, não edição — mesmo comportamento do
   * DashboardGrid pessoal. Desliga drag/resize/editar/remover mesmo para
   * admin, mas mantém "abrir detalhe" (é leitura). */
  fullscreen?: boolean;
}) {
  const editableNow = canEdit && !fullscreen;
  const widgetIds = widgets.map((widget) => widget.id);
  const { data: valuesData, isLoading } = useOrgDashboardValues(
    widgetIds.length > 0 ? widgetIds : undefined,
  );
  const now = new Date();
  const { data: goalsData } = useSalesGoals(now.getFullYear());
  const goalsByScope = buildGoalsByScope(
    goalsData?.goals ?? [],
    now.getFullYear(),
    now.getMonth() + 1,
  );
  const saveLayout = useSaveOrgLayout();
  const savePanelLayout = useSaveOrgPanelLayout();
  const removeWidget = useRemoveOrgWidget();
  const updateMutation = useUpdateOrgWidget();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const valueById = new Map(
    (valuesData?.values ?? []).map((entry) => [entry.widgetId, entry]),
  );
  const detailWidget = widgets.find((widget) => widget.id === detailId);
  const detailEntry = detailWidget ? valueById.get(detailWidget.id) : undefined;

  return (
    <>
      <OrgDashboardView
        widgets={widgets}
        panels={panels}
        values={(valuesData?.values ?? []) as never}
        isLoading={isLoading}
        canEdit={editableNow}
        goalsByScope={goalsByScope}
        onSaveLayout={
          editableNow
            ? (items) => saveLayout.mutate({ widgets: items })
            : undefined
        }
        onSavePanelLayout={
          editableNow
            ? (items) =>
                savePanelLayout.mutate({
                  panels: items.map((item) => ({
                    panelId: item.widgetId,
                    layout: item.layout,
                    sortOrder: item.sortOrder,
                  })),
                })
            : undefined
        }
        onEditWidget={editableNow ? (id) => setEditingId(id) : undefined}
        onRemoveWidget={
          editableNow
            ? (id) => removeWidget.mutate({ widgetId: id })
            : undefined
        }
        onOpenDetail={(id) => setDetailId(id)}
      />

      {editableNow && (
        <WidgetEditSheetCore
          widgetId={editingId}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
          dataSource={{
            widgets: widgets.map((widget) => ({
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
      )}

      {detailWidget && (
        <WidgetDetailDialog
          title={
            detailWidget.title ?? detailWidget.dataSourceKey ?? "Detalhamento"
          }
          value={(detailEntry?.value ?? null) as never}
          computedAt={detailEntry?.computedAt}
          widgetId={detailWidget.id}
          supportsDrilldown={false}
          onOpenChange={(open) => {
            if (!open) setDetailId(null);
          }}
        />
      )}
    </>
  );
}
