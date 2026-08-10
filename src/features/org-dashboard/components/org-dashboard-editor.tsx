"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWidgetCatalog } from "@/features/dashboard-widgets/hooks/use-widget-catalog";
import { WidgetDetailDialog } from "@/features/dashboard-widgets/components/widget-detail-dialog";
import { WidgetEditSheetCore } from "@/features/dashboard-widgets/components/widget-edit-sheet";
import { WidgetFrame } from "@/features/dashboard-widgets/components/widget-frame";
import {
  type WidgetPickerAddMutation,
  WidgetPickerSheetCore,
} from "@/features/dashboard-widgets/components/widget-picker-sheet";
import { ChartWidget } from "@/features/dashboard-widgets/components/widgets/chart-widget";
import { FeedWidget } from "@/features/dashboard-widgets/components/widgets/feed-widget";
import { FleetWidget } from "@/features/dashboard-widgets/components/widgets/fleet-widget";
import { ListWidget } from "@/features/dashboard-widgets/components/widgets/list-widget";
import { MapWidget } from "@/features/dashboard-widgets/components/widgets/map-widget";
import { StatWidget } from "@/features/dashboard-widgets/components/widgets/stat-widget";
import { TableWidget } from "@/features/dashboard-widgets/components/widgets/table-widget";
import {
  Building,
  Check,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Move,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  useAddOrgBoard,
  useAddOrgWidget,
  useOrgDashboardAdmin,
  useOrgDashboardValues,
  useRemoveOrgBoard,
  useRemoveOrgPanel,
  useRemoveOrgWidget,
  useReorderOrgBoards,
  useSaveOrgLayout,
  useSaveOrgPanelLayout,
  useUpdateOrgBoard,
  useUpdateOrgPanel,
  useUpdateOrgWidget,
} from "../hooks/use-org-dashboard";
import type { WidgetValue } from "@/features/dashboard-widgets/lib/widget-value";
import { PANEL_WIDGET_BREAKPOINTS } from "@/features/dashboard-widgets/lib/grid-breakpoints";
import { readAppearance } from "@/features/dashboard-widgets/lib/widget-appearance";
import {
  evaluateAlerts,
  readAlerts,
  type WidgetAlert,
} from "@/features/dashboard-widgets/lib/widget-alert";
import {
  augmentReportTable,
  buildGoalsByScope,
  readReportConfig,
  type ReportGoalScope,
} from "@/features/dashboard-widgets/lib/report-table";
import { useSalesGoals } from "@/features/dashboard-widgets/hooks/use-sales-goals";
import { cn } from "@/lib/utils";
import { panelStyles, readPanelAppearance } from "../lib/panel-appearance";
import { OrgDashboardPermissionsMatrix } from "./org-dashboard-permissions-matrix";
import { OrgDashboardSharePanel } from "./org-dashboard-share-panel";
import {
  ORG_PANEL_DRAG_HANDLE,
  type OrgGridWidget,
  type OrgLayoutSaveItem,
  OrgWidgetGrid,
  panelDefaultItem,
} from "./org-widget-grid";
import { WIDGET_DRAG_HANDLE_CLASS } from "@/features/dashboard-widgets/components/widget-frame";
import { BoardTabs, type BoardSummary } from "./board-tabs";
import { PanelEditDialog } from "./panel-edit-dialog";
import { PanelTemplatePicker } from "./panel-template-picker";

// Editor administrativo. Três abas na mesma página, pra não obrigar o
// admin a navegar entre telas separadas quando ele muda widget → permissão
// → share (que é o fluxo comum).
//
// Widgets aqui SÃO adicionados por um picker minimalista (data source +
// título + display type) — a customização fina (cor/ícone/aparência/alerta
// específica ao widget da org) vem quando reutilizarmos o
// `WidgetPickerSheet` completo do dashboard pessoal em Fase 3. Por ora o
// admin pode adicionar e depois refinar via o próprio dashboard pessoal se
// quiser copiar a configuração.

function FullscreenOrgLogo({
  logo,
  name,
}: {
  logo: string | null | undefined;
  name: string;
}) {
  const url = logo ? constructUrl(logo) : "";
  const [broken, setBroken] = useState(false);
  if (!url || broken)
    return <Building className="size-5 text-muted-foreground" />;
  return (
    <Image
      src={url}
      alt={name}
      width={28}
      height={28}
      className="rounded-md"
      onError={() => setBroken(true)}
    />
  );
}

export function OrgDashboardEditor() {
  const { data, isLoading } = useOrgDashboardAdmin();
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: activeOrg } = authClient.useActiveOrganization();

  // Mesmo padrão do "Meu dashboard": Fullscreen API de verdade, com fallback
  // visual (fixed inset-0) se o navegador negar. Em tela cheia vira modo
  // apresentação — some alça de arrastar, editar, remover e os botões de
  // adicionar (mesmo comportamento do WidgetFrame no dashboard pessoal).
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
      {fullscreen ? (
        <div className="flex items-center justify-between mb-6">
          <Image
            src="/orbita-hub.svg"
            alt="Orbita"
            width={100}
            height={28}
            className="h-7 w-auto"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={toggleFullscreen}
          >
            <Minimize2 className="size-4" /> Sair da tela cheia
          </Button>
          <FullscreenOrgLogo
            logo={activeOrg?.logo}
            name={activeOrg?.name ?? "Org"}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title="Dashboard da organização"
            description="Monte o dashboard que os membros compartilham, escolha quem vê o quê, e gere um link público (opcional) para telão/relatório."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="size-4" /> Tela cheia
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Falha ao carregar.</p>
      ) : fullscreen ? (
        <WidgetsTab
          widgets={data.dashboard?.widgets ?? []}
          panels={data.dashboard?.panels ?? []}
          boards={(data.dashboard?.boards ?? []) as BoardSummary[]}
          fullscreen={fullscreen}
        />
      ) : (
        <Tabs defaultValue="widgets">
          <TabsList>
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
            <TabsTrigger value="permissions">Quem vê o quê</TabsTrigger>
            <TabsTrigger value="share">Link público</TabsTrigger>
          </TabsList>

          <TabsContent value="widgets" className="mt-4">
            <WidgetsTab
              widgets={data.dashboard?.widgets ?? []}
              panels={data.dashboard?.panels ?? []}
              boards={(data.dashboard?.boards ?? []) as BoardSummary[]}
              fullscreen={fullscreen}
            />
          </TabsContent>
          <TabsContent value="permissions" className="mt-4">
            <OrgDashboardPermissionsMatrix
              widgets={data.dashboard?.widgets ?? []}
              permissions={data.permissions}
            />
          </TabsContent>
          <TabsContent value="share" className="mt-4">
            <OrgDashboardSharePanel
              shareToken={data.dashboard?.shareToken ?? null}
              publicName={data.dashboard?.publicName ?? null}
              publicVisibleWidgetIds={
                data.dashboard?.publicVisibleWidgetIds ?? []
              }
              widgets={data.dashboard?.widgets ?? []}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

interface WidgetRow {
  id: string;
  dataSourceKey: string;
  title: string | null;
  displayType: "STAT" | "CHART" | "LIST" | "MAP" | "TABLE";
  chartKind: "LINE" | "BAR" | "DONUT" | null;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  panelId?: string | null;
  options: unknown;
  layout?: unknown;
  sortOrder?: number;
}

interface PanelRow {
  id: string;
  category: string;
  title: string;
  color: string | null;
  sortOrder: number;
  templateKey: string | null;
  appearance?: unknown;
  layout?: unknown;
  boardId?: string | null;
}

interface OrgValueEntry {
  widgetId: string;
  value: WidgetValue | null;
  progressPercent: number | undefined;
  error: string | null;
  computedAt: string | null;
}

// Corpo de UM widget dentro do card de gestão — mesmo dispatch e MESMOS
// componentes de render que o dashboard de verdade (`OrgDashboardView`).
// Antes era um resumo custom (só a contagem/1ª linha); trocado porque um
// resumo nunca prova que o dado está completo — o admin precisa ver a lista
// inteira, com todas as colunas, sem sair do editor.
function WidgetBody({
  widget,
  entry,
  goalsByScope,
  alerts,
  targetValue,
}: {
  widget: WidgetRow;
  entry?: OrgValueEntry;
  goalsByScope?: Map<ReportGoalScope, Map<string, number>>;
  alerts?: WidgetAlert[];
  targetValue?: number | null;
}) {
  if (!entry) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (entry.error) {
    const calculating = entry.error === "Calculando…";
    return (
      <p
        className={cn(
          "text-xs",
          calculating ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {entry.error}
      </p>
    );
  }
  const value = entry.value;
  if (!value) {
    return <p className="text-muted-foreground text-xs">Sem dado.</p>;
  }
  const appearance = readAppearance(widget.options);
  const reportConfig = readReportConfig(widget.options);
  const goalsByCode = reportConfig?.goalScope
    ? goalsByScope?.get(reportConfig.goalScope)
    : undefined;
  switch (value.kind) {
    case "STAT":
      return (
        <StatWidget
          value={value}
          icon={widget.icon}
          progressPercent={entry.progressPercent}
          valueAlign={appearance.valueAlign}
          valueColor={appearance.valueColor}
          valueSize={appearance.valueSize}
          valueWeight={appearance.valueWeight}
          iconColor={appearance.iconColor}
        />
      );
    case "CHART":
      return <ChartWidget value={value} chartKind={widget.chartKind} />;
    case "MAP":
      return <MapWidget value={value} />;
    case "TABLE":
      return (
        <TableWidget
          value={
            reportConfig
              ? augmentReportTable(value, reportConfig, goalsByCode)
              : value
          }
          alerts={alerts}
          targetValue={targetValue}
        />
      );
    case "FLEET":
      return <FleetWidget value={value} />;
    case "FEED":
      return <FeedWidget value={value} />;
    default:
      return <ListWidget value={value} />;
  }
}

function WidgetsTab({
  widgets,
  panels,
  boards,
  fullscreen = false,
}: {
  widgets: WidgetRow[];
  panels: PanelRow[];
  boards: BoardSummary[];
  fullscreen?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPanelId, setPickerPanelId] = useState<string | null>(null);
  const [panelPickerOpen, setPanelPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  // Modo "reposicionar layout": ativa drag/resize do RGL. Fora dele, o grid é
  // estático (mesma renderização estável da Tela Cheia) e não entra no loop de
  // sync do react-grid-layout com re-renders alheios (poll de valores,
  // hover, etc.). Adicionar/editar/remover widget/painel/board seguem sempre
  // disponíveis, independente deste modo.
  const [layoutEditing, setLayoutEditing] = useState(false);
  const layoutEditable = layoutEditing && !fullscreen;
  const remove = useRemoveOrgWidget();
  const removePanel = useRemoveOrgPanel();
  const addMutation = useAddOrgWidget();
  const updateMutation = useUpdateOrgWidget();
  const saveLayout = useSaveOrgLayout();
  const savePanelLayout = useSaveOrgPanelLayout();
  const addBoard = useAddOrgBoard();
  const updateBoard = useUpdateOrgBoard();
  const removeBoard = useRemoveOrgBoard();
  const reorderBoards = useReorderOrgBoards();
  const { data: catalog } = useWidgetCatalog();

  const openPicker = (panelId: string | null) => {
    setPickerPanelId(panelId);
    setPickerOpen(true);
  };

  // O picker é o mesmo componente do dashboard pessoal; injetamos o painel
  // destino aqui, no wrapper da mutation, para não alargar o input dele.
  const addWithPanel: WidgetPickerAddMutation = {
    mutate: (input, options) =>
      addMutation.mutate({ ...input, panelId: pickerPanelId }, options),
    isPending: addMutation.isPending,
  };

  // Prévia ao vivo do valor de cada widget — o editor deixa de ser só
  // "título + tipo" e passa a mostrar o dado real (ou o erro), com o mesmo
  // poll do dashboard da org (rápido enquanto algum Oracle calcula).
  const { data: valuesData } = useOrgDashboardValues();
  const valueById = useMemo(
    () =>
      new Map(
        (valuesData?.values ?? []).map((entry) => [entry.widgetId, entry]),
      ),
    [valuesData],
  );
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const { data: goalsData } = useSalesGoals(currentYear);
  const goalsByScope = useMemo(
    () => buildGoalsByScope(goalsData?.goals ?? [], currentYear, currentMonth),
    [goalsData, currentYear, currentMonth],
  );
  const labelByKey = useMemo(
    () =>
      new Map(
        (catalog?.widgets ?? []).map((entry) => [entry.key, entry.label]),
      ),
    [catalog],
  );

  const topWidgets = useMemo(
    () => widgets.filter((widget) => !widget.parentId),
    [widgets],
  );
  const looseWidgets = useMemo(
    () => topWidgets.filter((widget) => !widget.panelId),
    [topWidgets],
  );
  const widgetsByPanel = useMemo(() => {
    const map = new Map<string, WidgetRow[]>();
    for (const widget of topWidgets) {
      if (!widget.panelId) continue;
      const list = map.get(widget.panelId) ?? [];
      list.push(widget);
      map.set(widget.panelId, list);
    }
    return map;
  }, [topWidgets]);

  const existingWidgets = widgets.map((widget) => ({
    id: widget.id,
    title: widget.title,
    dataSourceKey: widget.dataSourceKey,
    parentId: widget.parentId,
  }));
  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));

  // Card de gestão de UM widget. Preenche a célula do RGL (`h-full`), no
  // MESMO tamanho que o widget terá no dashboard real (a célula usa o layout
  // salvo do próprio widget) — então o corpo mostra o widget de verdade
  // (WidgetBody), não um resumo.
  //
  // O frame agora é o `WidgetFrame` (mesmo do view), então a prévia respeita
  // cor de fundo, contorno, título estilizado e o alinhamento vertical do
  // conteúdo salvos em `appearance`. A alça de arrasto passa a ser o próprio
  // cabeçalho do frame (`draggable`), no lugar do `GripVertical` inline com
  // classe `ORG_WIDGET_DRAG_HANDLE` — o RGL usa `WIDGET_DRAG_HANDLE_CLASS`
  // (default do frame) para achar a alça, e o handle antigo escondia a cor
  // de fundo atrás de um Card genérico.
  const renderWidgetCard = (id: string) => {
    const widget = widgetById.get(id);
    if (!widget) return null;
    const appearance = readAppearance(widget.options);
    const label =
      widget.title ??
      labelByKey.get(widget.dataSourceKey) ??
      widget.dataSourceKey;
    const opts = widget.options as { targetValue?: number } | null;
    const targetVal =
      typeof opts?.targetValue === "number" ? opts.targetValue : null;
    const widgetAlerts = readAlerts(widget.options);
    const isTable = widget.displayType === "TABLE";
    const alertResult = isTable
      ? { active: false, color: null, message: null }
      : evaluateAlerts(
          widgetAlerts,
          valueById.get(widget.id)?.value,
          targetVal,
        );
    return (
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
        draggable={layoutEditable}
        editable={!fullscreen}
        onEdit={!fullscreen ? () => setEditingId(widget.id) : undefined}
        onRemove={
          !fullscreen ? () => remove.mutate({ widgetId: widget.id }) : undefined
        }
        onOpenDetail={
          valueById.get(widget.id)?.value
            ? () => setDetailId(widget.id)
            : undefined
        }
      >
        <WidgetBody
          widget={widget}
          entry={valueById.get(widget.id)}
          goalsByScope={goalsByScope}
          alerts={widgetAlerts.length > 0 ? widgetAlerts : undefined}
          targetValue={targetVal}
        />
      </WidgetFrame>
    );
  };

  // Grade RGL de um escopo (painel ou soltos): arrastar + redimensionar,
  // persistindo o layout — o MESMO motor do "Meu Dashboard". `nested=true`
  // (widgets DENTRO de um painel) usa breakpoints calibrados pro container do
  // painel, não da página inteira — sem isso o grid interno cai sempre no
  // breakpoint mais estreito e os widgets nunca ficam lado a lado.
  const renderPanelSection = (panelId: string) => {
    const panel = panelById.get(panelId);
    if (!panel) return null;
    const panelWidgets = panelWidgetGridItems.get(panel.id);
    const hasWidgets = panelWidgets && panelWidgets.length > 0;
    const ps = panelStyles(panel.color, readPanelAppearance(panel.appearance));
    return (
      <section
        className={`flex h-full flex-col overflow-hidden rounded-md ${
          ps.noBorder ? "" : "border"
        }`}
        style={ps.sectionStyle}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-2"
          style={ps.headerStyle}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1 text-left",
              layoutEditable &&
                `${ORG_PANEL_DRAG_HANDLE} cursor-grab active:cursor-grabbing`,
            )}
            title={layoutEditable ? "Arrastar painel" : undefined}
          >
            {layoutEditable && (
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={`truncate ${ps.titleClass}`} style={ps.titleStyle}>
              {panel.title}
            </span>
          </div>
          {!fullscreen && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => openPicker(panel.id)}
              >
                <Plus className="size-3.5" /> Widget
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                title="Editar painel"
                onClick={() => setEditingPanelId(panel.id)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 text-destructive"
                title="Remover painel"
                onClick={() => removePanel.mutate({ panelId: panel.id })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
          style={{ scrollbarGutter: "stable" }}
        >
          {!hasWidgets ? (
            fullscreen ? (
              <p className="py-6 text-center text-muted-foreground text-xs">
                Painel vazio.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => openPicker(panel.id)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-6 text-muted-foreground text-xs hover:border-muted-foreground/60 hover:text-foreground"
              >
                <Plus className="size-3.5" /> Adicionar widget a este painel
              </button>
            )
          ) : (
            <OrgWidgetGrid
              editable={layoutEditable}
              widgets={panelWidgets}
              onSaveLayout={onSaveWidgetLayout}
              renderItem={renderWidgetCard}
              breakpoints={PANEL_WIDGET_BREAKPOINTS}
              dragHandleClass={WIDGET_DRAG_HANDLE_CLASS}
            />
          )}
        </div>
      </section>
    );
  };

  const sortedBoards = useMemo(
    () => [...boards].sort((a, b) => a.sortOrder - b.sortOrder),
    [boards],
  );
  const visiblePanels = useMemo(
    () =>
      selectedBoardId === null
        ? panels
        : panels.filter((p) => p.boardId === selectedBoardId),
    [panels, selectedBoardId],
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
    for (const [panelId, panelWidgets] of widgetsByPanel) {
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
  }, [widgetsByPanel]);

  const looseWidgetGridItems = useMemo<OrgGridWidget[]>(
    () =>
      looseWidgets.map((w) => ({
        id: w.id,
        layout: w.layout ?? null,
        sortOrder: w.sortOrder ?? 0,
      })),
    [looseWidgets],
  );

  const onSavePanelLayout = useCallback(
    (items: OrgLayoutSaveItem[]) =>
      savePanelLayout.mutate({
        panels: items.map((item) => ({
          panelId: item.widgetId,
          layout: item.layout,
          sortOrder: item.sortOrder,
        })),
      }),
    [savePanelLayout],
  );

  const onSaveWidgetLayout = useCallback(
    (items: OrgLayoutSaveItem[]) => saveLayout.mutate({ widgets: items }),
    [saveLayout],
  );

  const [linkingBoardId, setLinkingBoardId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {!fullscreen && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {panels.length === 0 && topWidgets.length === 0
              ? "Nenhum painel ou widget ainda."
              : `${panels.length} painel(éis), ${topWidgets.length} widget(s) no modelo.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={layoutEditing ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setLayoutEditing((v) => !v)}
              title={
                layoutEditing
                  ? "Concluir reposicionamento — grid volta ao modo estável"
                  : "Ativar arrastar/redimensionar dos painéis e widgets"
              }
            >
              {layoutEditing ? (
                <>
                  <Check className="size-4" /> Concluir layout
                </>
              ) : (
                <>
                  <Move className="size-4" /> Reposicionar layout
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setPanelPickerOpen(true)}
            >
              <LayoutGrid className="size-4" /> Adicionar painel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => openPicker(null)}
            >
              <Plus className="size-4" /> Adicionar widget solto
            </Button>
          </div>
        </div>
      )}

      {!pickerOpen && !editingId && (
        <BoardTabs
          boards={sortedBoards}
          selectedBoardId={selectedBoardId}
          onSelect={setSelectedBoardId}
          editable={!fullscreen}
          onAdd={(title) => addBoard.mutate({ title })}
          onRename={(boardId, title) => updateBoard.mutate({ boardId, title })}
          onRemove={(boardId) => removeBoard.mutate({ boardId })}
          onReorder={(boardIds) => reorderBoards.mutate({ boardIds })}
          onLinkPanels={!fullscreen ? setLinkingBoardId : undefined}
        />
      )}

      {panelGridWidgets.length > 0 && (
        <OrgWidgetGrid
          editable={layoutEditable}
          widgets={panelGridWidgets}
          onSaveLayout={onSavePanelLayout}
          dragHandleClass={ORG_PANEL_DRAG_HANDLE}
          defaultItem={panelDefaultItem}
          renderItem={renderPanelSection}
        />
      )}

      {selectedBoardId === null && looseWidgetGridItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Widgets soltos
          </h3>
          <OrgWidgetGrid
            editable={layoutEditable}
            widgets={looseWidgetGridItems}
            onSaveLayout={onSaveWidgetLayout}
            renderItem={renderWidgetCard}
            dragHandleClass={WIDGET_DRAG_HANDLE_CLASS}
          />
        </section>
      )}

      {/* Picker completo (cor/ícone/aparência/alerta) — mesmo componente
        que o dashboard pessoal usa, injetando a mutation da org + o painel
        destino escolhido. */}
      <WidgetPickerSheetCore
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        dataSource={{ addMutation: addWithPanel, existingWidgets }}
      />

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
            panelId: widget.panelId,
            options: widget.options,
          })),
          updateMutation,
          panels: panels.map((p) => ({ id: p.id, title: p.title })),
        }}
      />

      <PanelTemplatePicker
        open={panelPickerOpen}
        onOpenChange={setPanelPickerOpen}
      />

      <PanelEditDialog
        panel={panels.find((panel) => panel.id === editingPanelId) ?? null}
        boards={sortedBoards}
        onOpenChange={(open) => {
          if (!open) setEditingPanelId(null);
        }}
      />

      <LinkPanelsDialog
        boardId={linkingBoardId}
        panels={panels}
        onOpenChange={(open) => {
          if (!open) setLinkingBoardId(null);
        }}
      />

      {detailId &&
        (() => {
          const detailWidget = widgetById.get(detailId);
          const detailEntry = detailWidget
            ? valueById.get(detailWidget.id)
            : undefined;
          if (!detailWidget) return null;
          return (
            <WidgetDetailDialog
              title={
                detailWidget.title ??
                labelByKey.get(detailWidget.dataSourceKey) ??
                "Detalhamento"
              }
              value={(detailEntry?.value ?? null) as never}
              computedAt={detailEntry?.computedAt}
              widgetId={detailWidget.id}
              supportsDrilldown={false}
              onOpenChange={(open) => {
                if (!open) setDetailId(null);
              }}
            />
          );
        })()}
    </div>
  );
}

function LinkPanelsDialog({
  boardId,
  panels,
  onOpenChange,
}: {
  boardId: string | null;
  panels: PanelRow[];
  onOpenChange: (open: boolean) => void;
}) {
  const updatePanel = useUpdateOrgPanel();
  const linked = panels.filter((p) => p.boardId === boardId);
  const unlinked = panels.filter((p) => !p.boardId || p.boardId !== boardId);

  if (!boardId) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Vincular painéis ao quadro</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {panels.length === 0 && (
            <p className="py-4 text-center text-muted-foreground text-sm">
              Nenhum painel criado ainda.
            </p>
          )}
          {linked.map((panel) => (
            <label
              key={panel.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <input
                type="checkbox"
                checked
                onChange={() =>
                  updatePanel.mutate({ panelId: panel.id, boardId: null })
                }
                className="size-4 accent-primary"
              />
              <span className="text-sm">{panel.title}</span>
            </label>
          ))}
          {unlinked.map((panel) => (
            <label
              key={panel.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() =>
                  updatePanel.mutate({ panelId: panel.id, boardId })
                }
                className="size-4 accent-primary"
              />
              <span className="text-sm">
                {panel.title}
                {panel.boardId && (
                  <span className="ml-1 text-muted-foreground text-xs">
                    (em outro quadro)
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
