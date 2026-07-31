"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWidgetCatalog } from "@/features/dashboard-widgets/hooks/use-widget-catalog";
import { WidgetEditSheetCore } from "@/features/dashboard-widgets/components/widget-edit-sheet";
import {
  type WidgetPickerAddMutation,
  WidgetPickerSheetCore,
} from "@/features/dashboard-widgets/components/widget-picker-sheet";
import {
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAddOrgWidget,
  useOrgDashboardAdmin,
  useOrgDashboardValues,
  useRemoveOrgPanel,
  useRemoveOrgWidget,
  useSaveOrgLayout,
  useSaveOrgPanelLayout,
  useUpdateOrgWidget,
} from "../hooks/use-org-dashboard";
import { formatWidgetValue } from "@/features/dashboard-widgets/lib/widget-value";
import type { WidgetValue } from "@/features/dashboard-widgets/lib/widget-value";
import { PANEL_WIDGET_BREAKPOINTS } from "@/features/dashboard-widgets/lib/grid-breakpoints";
import { cn } from "@/lib/utils";
import { panelStyles, readPanelAppearance } from "../lib/panel-appearance";
import { OrgDashboardPermissionsMatrix } from "./org-dashboard-permissions-matrix";
import { OrgDashboardSharePanel } from "./org-dashboard-share-panel";
import {
  ORG_PANEL_DRAG_HANDLE,
  ORG_WIDGET_DRAG_HANDLE,
  OrgWidgetGrid,
  panelDefaultItem,
} from "./org-widget-grid";
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

export function OrgDashboardEditor() {
  const { data, isLoading } = useOrgDashboardAdmin();
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3",
          fullscreen && "mb-6",
        )}
      >
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

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Falha ao carregar.</p>
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
}

interface OrgValueEntry {
  widgetId: string;
  value: WidgetValue | null;
  progressPercent: number | undefined;
  error: string | null;
  computedAt: string | null;
}

// Prévia compacta do valor de um widget dentro do card de gestão. Não é o
// render completo (isso vive no `OrgDashboardView`) — aqui basta o número, a
// contagem ou o erro, para o admin conferir que a fonte está trazendo dado
// sem sair do editor.
function WidgetValuePreview({ entry }: { entry?: OrgValueEntry }) {
  if (!entry) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (entry.error) {
    const calculating = entry.error === "Calculando…";
    return (
      <span
        className={cn(
          "min-w-0 truncate",
          calculating ? "text-muted-foreground" : "text-destructive",
        )}
        title={entry.error}
      >
        {entry.error}
      </span>
    );
  }
  const value = entry.value;
  if (!value) {
    return <span className="text-muted-foreground">Sem dado</span>;
  }
  switch (value.kind) {
    case "STAT":
      return (
        <span className="truncate font-medium text-foreground tabular-nums">
          {formatWidgetValue(value.value, value.unit)}
        </span>
      );
    case "LIST":
      return (
        <span className="text-muted-foreground">
          {value.items.length} {value.items.length === 1 ? "item" : "itens"}
        </span>
      );
    case "CHART":
      return (
        <span className="text-muted-foreground">
          {value.series.length} pontos
        </span>
      );
    case "TABLE": {
      // Só a contagem ("29 linhas") não prova que o dado é real — mostra as
      // duas primeiras células da linha de topo (já vem ordenada por
      // measureDesc, então é o maior valor) junto com a contagem.
      const first = value.rows[0];
      if (!first) {
        return <span className="text-muted-foreground">Sem linhas</span>;
      }
      const preview = first.cells
        .slice(0, 2)
        .map((cell, index) => {
          const column = value.columns[index];
          return typeof cell === "number"
            ? formatWidgetValue(cell, column?.unit)
            : (cell ?? "—");
        })
        .join(" · ");
      return (
        <span className="min-w-0 truncate" title={preview}>
          <span className="font-medium text-foreground">{preview}</span>{" "}
          <span className="text-[10px] text-muted-foreground">
            ({value.rows.length} linhas)
          </span>
        </span>
      );
    }
    case "MAP":
      return (
        <span className="text-muted-foreground">
          {value.regions.length} regiões
        </span>
      );
    case "FLEET":
      return (
        <span className="text-muted-foreground">
          {value.trucks.length} caminhões
        </span>
      );
    case "FEED":
      return (
        <span className="text-muted-foreground">
          {value.items.length} alertas
        </span>
      );
  }
}

function WidgetsTab({
  widgets,
  panels,
  fullscreen = false,
}: {
  widgets: WidgetRow[];
  panels: PanelRow[];
  /** Modo apresentação: some alça de arrastar, editar, remover e os botões
   * de adicionar — só o conteúdo dos widgets fica visível. */
  fullscreen?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Painel destino do picker: null = "widget solto" na raiz. Definido ao abrir
  // o picker a partir do botão de um painel específico.
  const [pickerPanelId, setPickerPanelId] = useState<string | null>(null);
  const [panelPickerOpen, setPanelPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const remove = useRemoveOrgWidget();
  const removePanel = useRemoveOrgPanel();
  const addMutation = useAddOrgWidget();
  const updateMutation = useUpdateOrgWidget();
  const saveLayout = useSaveOrgLayout();
  const savePanelLayout = useSaveOrgPanelLayout();
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
  const labelByKey = useMemo(
    () =>
      new Map(
        (catalog?.widgets ?? []).map((entry) => [entry.key, entry.label]),
      ),
    [catalog],
  );

  const topWidgets = widgets.filter((widget) => !widget.parentId);
  // "Widgets soltos" = widgets sem painel (compatibilidade com o modo antigo).
  const looseWidgets = topWidgets.filter((widget) => !widget.panelId);
  // Widgets por painel — indexado para render.
  const widgetsByPanel = new Map<string, WidgetRow[]>();
  for (const widget of topWidgets) {
    if (!widget.panelId) continue;
    const list = widgetsByPanel.get(widget.panelId) ?? [];
    list.push(widget);
    widgetsByPanel.set(widget.panelId, list);
  }

  const existingWidgets = widgets.map((widget) => ({
    id: widget.id,
    title: widget.title,
    dataSourceKey: widget.dataSourceKey,
    parentId: widget.parentId,
  }));
  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));

  // Card de gestão de UM widget. Preenche a célula do RGL (`h-full`); a alça
  // `ORG_WIDGET_DRAG_HANDLE` é o que o RGL usa para arrastar — o resto do card
  // (botões) continua clicável.
  const renderWidgetCard = (id: string) => {
    const widget = widgetById.get(id);
    if (!widget) return null;
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1">
              {!fullscreen && (
                <button
                  type="button"
                  title="Arrastar widget"
                  className={`${ORG_WIDGET_DRAG_HANDLE} -ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing`}
                >
                  <GripVertical className="size-3.5" />
                </button>
              )}
              <span className="truncate text-left">
                {widget.title ??
                  labelByKey.get(widget.dataSourceKey) ??
                  widget.dataSourceKey}
              </span>
            </span>
            <span className="shrink-0 font-normal text-[10px] text-muted-foreground uppercase tracking-wide">
              {widget.displayType}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-between gap-2 text-xs">
          <WidgetValuePreview entry={valueById.get(widget.id)} />
          {!fullscreen && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                title="Personalizar"
                onClick={() => setEditingId(widget.id)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 text-destructive"
                title="Remover"
                onClick={() => remove.mutate({ widgetId: widget.id })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Grade RGL de um escopo (painel ou soltos): arrastar + redimensionar,
  // persistindo o layout — o MESMO motor do "Meu Dashboard". `nested=true`
  // (widgets DENTRO de um painel) usa breakpoints calibrados pro container do
  // painel, não da página inteira — sem isso o grid interno cai sempre no
  // breakpoint mais estreito e os widgets nunca ficam lado a lado.
  const renderWidgetGrid = (list: WidgetRow[], nested = false) => (
    <OrgWidgetGrid
      editable={!fullscreen}
      widgets={list.map((widget) => ({
        id: widget.id,
        layout: widget.layout ?? null,
        sortOrder: widget.sortOrder ?? 0,
      }))}
      onSaveLayout={(items) => saveLayout.mutate({ widgets: items })}
      renderItem={renderWidgetCard}
      breakpoints={nested ? PANEL_WIDGET_BREAKPOINTS : undefined}
    />
  );

  // Um painel = célula da grade externa (redimensionável pela alça no canto,
  // arrastável pelo cabeçalho). `h-full` para preencher a célula; corpo rola.
  const renderPanelSection = (panelId: string) => {
    const panel = panelById.get(panelId);
    if (!panel) return null;
    const panelWidgets = widgetsByPanel.get(panel.id) ?? [];
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
              !fullscreen &&
                `${ORG_PANEL_DRAG_HANDLE} cursor-grab active:cursor-grabbing`,
            )}
            title={fullscreen ? undefined : "Arrastar painel"}
          >
            {!fullscreen && (
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
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {panelWidgets.length === 0 ? (
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
            renderWidgetGrid(panelWidgets, true)
          )}
        </div>
      </section>
    );
  };

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

      {/* Painéis = grade externa: arraste o cabeçalho para mover, a alça no
        canto inferior direito para redimensionar (mesmo recurso dos widgets). */}
      {panels.length > 0 && (
        <OrgWidgetGrid
          editable={!fullscreen}
          widgets={panels.map((panel) => ({
            id: panel.id,
            layout: panel.layout ?? null,
            sortOrder: panel.sortOrder,
          }))}
          onSaveLayout={(items) =>
            savePanelLayout.mutate({
              panels: items.map((item) => ({
                panelId: item.widgetId,
                layout: item.layout,
                sortOrder: item.sortOrder,
              })),
            })
          }
          dragHandleClass={ORG_PANEL_DRAG_HANDLE}
          defaultItem={panelDefaultItem}
          renderItem={renderPanelSection}
        />
      )}

      {/* Widgets fora de painel (opcional, retrocompatível). */}
      {looseWidgets.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Widgets soltos
          </h3>
          {renderWidgetGrid(looseWidgets)}
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
            options: widget.options,
          })),
          updateMutation,
        }}
      />

      <PanelTemplatePicker
        open={panelPickerOpen}
        onOpenChange={setPanelPickerOpen}
      />

      <PanelEditDialog
        panel={panels.find((panel) => panel.id === editingPanelId) ?? null}
        onOpenChange={(open) => {
          if (!open) setEditingPanelId(null);
        }}
      />
    </div>
  );
}
