"use client";

import "react-grid-layout/css/styles.css";
import { useEffect, useRef, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout, ResponsiveLayouts } from "react-grid-layout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWidgetValue } from "../lib/widget-value";
import {
  useAddDashboardWidget,
  useDashboardWidgetValues,
  useMyDashboardWidgets,
  useRefreshOracleWidget,
  useRemoveDashboardWidget,
  useSaveDashboardLayout,
} from "../hooks/use-dashboard-widgets";
import { useAlertDismissal } from "../hooks/use-alert-dismissal";
import { useNotificationPermission } from "../hooks/use-notification-permission";
import { useWidgetCatalog } from "../hooks/use-widget-catalog";
import { playAlertSound } from "../lib/alert-sound";
import { ORACLE_CUSTOM_KEY } from "../lib/oracle-query-config";
import {
  ALERT_TOLERANCE_MINUTES,
  readAlert,
  renderAlertMessage,
} from "../lib/widget-alert";
import { readAppearance } from "../lib/widget-appearance";
import {
  BREAKPOINTS_WITH_LAYOUT,
  COLLAPSED_ROWS,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  type GridBreakpoint,
  type GridItemLayout,
  mobileRowsFor,
} from "../lib/grid-breakpoints";
import { WidgetChildren } from "./widget-children";
import { WidgetDetailDialog } from "./widget-detail-dialog";
import { WidgetEditSheet } from "./widget-edit-sheet";
import {
  WIDGET_DRAG_HANDLE_CLASS,
  WIDGET_NO_DRAG_CLASS,
  WidgetFrame,
} from "./widget-frame";
import { ChartWidget } from "./widgets/chart-widget";
import { FeedWidget } from "./widgets/feed-widget";
import { FleetWidget } from "./widgets/fleet-widget";
import { ListWidget } from "./widgets/list-widget";
import { MapWidget } from "./widgets/map-widget";
import { RankingWidget } from "./widgets/ranking-widget";
import { StatWidget } from "./widgets/stat-widget";
import { TableWidget } from "./widgets/table-widget";

// Único data source com uma visualização "de verdade" própria em vez do
// dispatch genérico STAT/CHART/LIST — pedido explícito de mostrar o ranking
// igual à tela original, com pódio e tudo mais.
const RICH_RANKING_KEY = "ranking.teamRankingTop";

const DEFAULT_WIDGET_KEYS = [
  "native.salesTotal",
  "native.salesToday",
  "native.lowStockCount",
  "native.latestSales",
] as const;

function fallbackItem(w: number, h: number, index: number): GridItemLayout {
  return { x: 0, y: index * h, w, h };
}

export function DashboardGrid({
  fullscreen = false,
}: {
  fullscreen?: boolean;
}) {
  const { data: widgetsData, isLoading: isLoadingWidgets } =
    useMyDashboardWidgets();
  const { data: catalogData } = useWidgetCatalog();
  const allWidgets = widgetsData?.widgets ?? [];
  // Só os de topo entram na grade — os aninhados são desenhados dentro do card
  // do pai e não têm posição própria.
  const widgets = allWidgets.filter((widget) => !widget.parentId);
  const childrenByParent = new Map<string, typeof allWidgets>();
  for (const widget of allWidgets) {
    if (!widget.parentId) continue;
    const list = childrenByParent.get(widget.parentId) ?? [];
    list.push(widget);
    childrenByParent.set(widget.parentId, list);
  }
  // Os filhos também precisam de valor resolvido, então entram no pedido.
  const widgetIds = allWidgets.map((widget) => widget.id);
  const { data: valuesData } = useDashboardWidgetValues(
    widgetIds.length > 0 ? widgetIds : undefined,
  );
  const removeWidget = useRemoveDashboardWidget();
  const addWidget = useAddDashboardWidget();
  const saveLayout = useSaveDashboardLayout();
  const refreshOracle = useRefreshOracleWidget();
  const { isDismissed, dismiss } = useAlertDismissal();
  const { notify: notifySystem } = useNotificationPermission();

  const labelByKey = new Map(
    (catalogData?.widgets ?? []).map((entry) => [entry.key, entry.label]),
  );
  const valueByWidgetId = new Map(
    (valuesData?.values ?? []).map((entry) => [entry.widgetId, entry.value]),
  );
  const progressByWidgetId = new Map(
    (valuesData?.values ?? []).map((entry) => [
      entry.widgetId,
      entry.progressPercent,
    ]),
  );
  const metaByWidgetId = new Map(
    (valuesData?.values ?? []).map((entry) => [
      entry.widgetId,
      { error: entry.error, computedAt: entry.computedAt },
    ]),
  );

  const { width, containerRef, mounted } = useContainerWidth();
  const [breakpoint, setBreakpoint] = useState<GridBreakpoint>("lg");
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [detailWidgetId, setDetailWidgetId] = useState<string | null>(null);
  // Estado de sessão, não persistido: recolher é uma ação de leitura ("quero
  // ver o resto da lista agora"), não uma preferência do dashboard.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const seededRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Primeira visita sem widget nenhum: semeia um conjunto default — só uma
  // vez por sessão, só depois que sabemos de verdade que a lista está vazia
  // (não durante o loading inicial), e só depois que o catálogo carregou —
  // precisamos do supportedDisplayTypes real de cada fonte (ex.: "Últimas
  // vendas" só existe como LISTA; chumbar "STAT" pra tudo fazia esse widget
  // falhar em silêncio com BAD_REQUEST).
  // biome-ignore lint/correctness/useExhaustiveDependencies: só dispara uma vez ao detectar dashboard vazio — `addWidget.mutate` muda de identidade a cada render e não deve retrigger isto.
  useEffect(() => {
    if (
      isLoadingWidgets ||
      seededRef.current ||
      widgets.length > 0 ||
      !catalogData
    ) {
      return;
    }
    seededRef.current = true;
    const supportedByKey = new Map(
      catalogData.widgets.map((entry) => [
        entry.key,
        entry.supportedDisplayTypes[0],
      ]),
    );
    for (const key of DEFAULT_WIDGET_KEYS) {
      const displayType = supportedByKey.get(key);
      if (!displayType) continue;
      addWidget.mutate({ dataSourceKey: key, displayType });
    }
  }, [isLoadingWidgets, widgets.length, catalogData]);

  // Toast dos alertas que dispararam desde a última visita: reroda quando
  // qualquer widget muda de `lastFiredAt`. A dispensa é local (localStorage),
  // então o toast some assim que o usuário fecha; se o cron disparar de novo
  // amanhã, o novo timestamp invalida a dispensa e o toast reaparece.
  //
  // Só considera disparos recentes (última janela horária, com tolerância)
  // para não bombardear o gerente com alertas antigos ao abrir o dashboard
  // no fim do dia.
  const alertLookup = allWidgets
    .map((widget) => {
      const alert = readAlert(widget.options);
      if (!alert.enabled || !alert.lastFiredAt) return null;
      const ageMinutes =
        (Date.now() - new Date(alert.lastFiredAt).getTime()) / 60_000;
      // Janela de "recente": 24h. Suficiente para o gerente abrir depois do
      // almoço e ainda ver o alerta das 14h.
      if (ageMinutes > 24 * 60 + ALERT_TOLERANCE_MINUTES) return null;
      const title =
        widget.title ?? labelByKey.get(widget.dataSourceKey) ?? "Widget";
      const options = widget.options as { targetValue?: unknown } | null;
      const target =
        typeof options?.targetValue === "number"
          ? (options.targetValue as number)
          : null;
      const message = renderAlertMessage(alert.message, {
        valor:
          alert.lastFiredValue !== null
            ? formatWidgetValue(alert.lastFiredValue)
            : "—",
        meta: target !== null ? formatWidgetValue(target) : "—",
      });
      return {
        widgetId: widget.id,
        title,
        firedAt: alert.lastFiredAt,
        message,
        playSound: alert.playSound,
        showNotification: alert.showNotification,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: só quero disparar quando um NOVO firedAt entra em cena; `dismiss`/`isDismissed`/`notifySystem` são refs estáveis de closure
  useEffect(() => {
    for (const entry of alertLookup) {
      if (isDismissed(entry.widgetId, entry.firedAt)) continue;
      toast.warning(entry.title, {
        description: entry.message,
        duration: 8000,
        onDismiss: () => dismiss(entry.widgetId, entry.firedAt),
        onAutoClose: () => dismiss(entry.widgetId, entry.firedAt),
      });
      // Som e notificação do sistema são best-effort: rodam se o usuário já
      // ativou; se não, o toast já cobriu.
      if (entry.playSound) playAlertSound();
      if (entry.showNotification) notifySystem(entry.title, entry.message);
    }
  }, [alertLookup.map((entry) => `${entry.widgetId}:${entry.firedAt}`).join()]);

  if (isLoadingWidgets) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const layouts: ResponsiveLayouts<GridBreakpoint> = {
    lg: [],
    md: [],
    sm: [],
    xxs: [],
  };
  const sortedForMobile = [...widgets].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  for (const breakpointKey of BREAKPOINTS_WITH_LAYOUT) {
    layouts[breakpointKey] = widgets.map((widget, index) => {
      const stored = widget.layout as Record<string, GridItemLayout> | null;
      const item = stored?.[breakpointKey] ?? fallbackItem(3, 2, index);
      // Retraído vale em qualquer breakpoint — senão o conteúdo some mas o
      // card mantém a altura, deixando um buraco no lugar.
      if (collapsedIds.has(widget.id)) {
        return { i: widget.id, ...item, h: COLLAPSED_ROWS };
      }
      // Em `sm` o card fica estreito (4 colunas), e a altura salva foi
      // pensada num card largo — o mesmo conteúdo quebra em mais linhas.
      // Piso pela altura de conteúdo evita corte.
      if (breakpointKey === "sm") {
        const minimo = mobileRowsFor({
          displayType: widget.displayType,
          dataSourceKey: widget.dataSourceKey,
          childCount: (childrenByParent.get(widget.id) ?? []).length,
        });
        return { i: widget.id, ...item, h: Math.max(item.h, minimo) };
      }
      return { i: widget.id, ...item };
    });
  }
  // Empilhamento mobile: altura vem do CONTEÚDO (um pódio precisa de muito
  // mais que um card de número) e o `y` é acumulado, já que as alturas variam.
  let mobileY = 0;
  layouts.xxs = sortedForMobile.map((widget) => {
    const h = collapsedIds.has(widget.id)
      ? COLLAPSED_ROWS
      : mobileRowsFor({
          displayType: widget.displayType,
          dataSourceKey: widget.dataSourceKey,
          childCount: (childrenByParent.get(widget.id) ?? []).length,
        });
    const item = { i: widget.id, x: 0, y: mobileY, w: 1, h };
    mobileY += h;
    return item;
  });

  const handleLayoutChange = (
    _layout: Layout,
    allLayouts: ResponsiveLayouts<GridBreakpoint>,
  ) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const mobileOrder = [...(allLayouts.xxs ?? [])].sort((a, b) => a.y - b.y);
      const sortOrderByWidgetId = new Map(
        mobileOrder.map((item, index) => [item.i, index]),
      );
      const payload = widgets
        // Widget retraído está com altura 1 SÓ PARA EXIBIÇÃO. Persistir isso
        // gravaria "altura 1" de verdade e, ao esticar de novo, o card voltaria
        // achatado para sempre. Fora do lote enquanto estiver recolhido.
        .filter((widget) => !collapsedIds.has(widget.id))
        .map((widget, index) => ({
          widgetId: widget.id,
          layout: {
            lg: pickLayoutItem(allLayouts.lg, widget.id),
            md: pickLayoutItem(allLayouts.md, widget.id),
            sm: pickLayoutItem(allLayouts.sm, widget.id),
          },
          sortOrder: sortOrderByWidgetId.get(widget.id) ?? index,
        }));
      if (payload.length > 0) saveLayout.mutate({ widgets: payload });
    }, 400);
  };

  // Modo TV (fullscreen): apresentação, não edição — some a alça de arraste,
  // a engrenagem de personalizar e o X de remover (fica só o título), e
  // arraste/resize ficam desligados pra não mexer no layout sem querer numa
  // tela grande de apresentação.
  const detailWidget = widgets.find((widget) => widget.id === detailWidgetId);
  const detailWidgetTitle = detailWidget
    ? (detailWidget.title ??
      labelByKey.get(detailWidget.dataSourceKey) ??
      "Widget")
    : "";

  const editable = !fullscreen;
  const isMobile = breakpoint === "xxs" || breakpoint === "sm";
  // Arrastar vale também no mobile (só a tela cheia desliga): reordenar o
  // dashboard no celular é justamente onde mais se precisa. Já o resize por
  // toque é impreciso demais — no mobile quem resolve altura é o retrair.
  const dragEnabled = !fullscreen;
  const resizeEnabled = !isMobile && !fullscreen;

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          width={width}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          layouts={layouts}
          rowHeight={GRID_ROW_HEIGHT}
          margin={[16, 16]}
          dragConfig={{
            handle: `.${WIDGET_DRAG_HANDLE_CLASS}`,
            // Sem isto os botões do cabeçalho (que É a alça) não recebem toque
            // no mobile — o arraste engole o touchstart antes de virar clique.
            cancel: `.${WIDGET_NO_DRAG_CLASS}`,
            enabled: dragEnabled,
          }}
          resizeConfig={{ enabled: resizeEnabled }}
          onBreakpointChange={(next) => setBreakpoint(next)}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((widget) => {
            const value = valueByWidgetId.get(widget.id);
            // Nome escolhido pelo usuário vence; sem ele, o rótulo da fonte.
            const label =
              widget.title ?? labelByKey.get(widget.dataSourceKey) ?? "Widget";
            const meta = metaByWidgetId.get(widget.id);
            const isOracle = widget.dataSourceKey === ORACLE_CUSTOM_KEY;
            const appearance = readAppearance(widget.options);
            const alertEntry = alertLookup.find(
              (entry) => entry.widgetId === widget.id,
            );
            // Só destaca o card se o alerta é RECENTE (na janela do lookup) e
            // ainda não foi dispensado. Alerta velho ou dispensado volta ao
            // visual padrão.
            const alertActive =
              !!alertEntry && !isDismissed(widget.id, alertEntry.firedAt);
            const alertConfig = readAlert(widget.options);
            return (
              <div key={widget.id}>
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
                  alertColor={alertActive ? alertConfig.color : null}
                  alertMessage={alertActive ? alertEntry?.message : null}
                  editable={editable}
                  onEdit={() => setEditingWidgetId(widget.id)}
                  onRemove={() => removeWidget.mutate({ widgetId: widget.id })}
                  onRefresh={
                    isOracle
                      ? () => refreshOracle.mutate({ widgetId: widget.id })
                      : undefined
                  }
                  refreshing={
                    refreshOracle.isPending &&
                    refreshOracle.variables?.widgetId === widget.id
                  }
                  computedAt={meta?.computedAt}
                  onOpenDetail={
                    value ? () => setDetailWidgetId(widget.id) : undefined
                  }
                  draggable={dragEnabled}
                  // Esticar/retrair só no mobile: no desktop já dá para
                  // redimensionar arrastando o canto do card.
                  onToggleCollapse={
                    isMobile
                      ? () =>
                          setCollapsedIds((current) => {
                            const next = new Set(current);
                            if (next.has(widget.id)) next.delete(widget.id);
                            else next.add(widget.id);
                            return next;
                          })
                      : undefined
                  }
                  collapsed={collapsedIds.has(widget.id)}
                >
                  {widget.dataSourceKey === RICH_RANKING_KEY ? (
                    <RankingWidget />
                  ) : value === undefined ? (
                    <Skeleton className="h-full w-full" />
                  ) : value === null ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {meta?.error ?? "Fonte de dado removida."}
                    </p>
                  ) : value.kind === "STAT" ? (
                    <StatWidget
                      value={value}
                      icon={widget.icon}
                      progressPercent={progressByWidgetId.get(widget.id)}
                      valueAlign={appearance.valueAlign}
                      valueColor={appearance.valueColor}
                      valueSize={appearance.valueSize}
                      valueWeight={appearance.valueWeight}
                      iconColor={appearance.iconColor}
                    />
                  ) : value.kind === "CHART" ? (
                    <ChartWidget value={value} chartKind={widget.chartKind} />
                  ) : value.kind === "MAP" ? (
                    <MapWidget value={value} />
                  ) : value.kind === "TABLE" ? (
                    <TableWidget value={value} />
                  ) : value.kind === "FLEET" ? (
                    <FleetWidget value={value} />
                  ) : value.kind === "FEED" ? (
                    <FeedWidget value={value} />
                  ) : (
                    <ListWidget value={value} />
                  )}

                  <WidgetChildren
                    editable={editable}
                    onRemove={(childId) =>
                      removeWidget.mutate({ widgetId: childId })
                    }
                    items={(childrenByParent.get(widget.id) ?? []).map(
                      (child) => ({
                        id: child.id,
                        title:
                          child.title ??
                          labelByKey.get(child.dataSourceKey) ??
                          "Widget",
                        icon: child.icon,
                        value: valueByWidgetId.get(child.id),
                        error: metaByWidgetId.get(child.id)?.error,
                      }),
                    )}
                  />
                </WidgetFrame>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      {widgets.length === 0 && !isLoadingWidgets && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum widget no seu dashboard ainda.
          </p>
          <Button type="button" variant="outline" size="sm" disabled>
            Preparando widgets padrão…
          </Button>
        </div>
      )}

      <WidgetEditSheet
        widgetId={editingWidgetId}
        onOpenChange={(open) => {
          if (!open) setEditingWidgetId(null);
        }}
      />

      {detailWidget && (
        <WidgetDetailDialog
          title={detailWidgetTitle}
          value={valueByWidgetId.get(detailWidget.id) ?? null}
          computedAt={metaByWidgetId.get(detailWidget.id)?.computedAt}
          widgetId={detailWidget.id}
          supportsDrilldown={detailWidget.dataSourceKey === ORACLE_CUSTOM_KEY}
          onOpenChange={(open) => {
            if (!open) setDetailWidgetId(null);
          }}
        />
      )}
    </div>
  );
}

function pickLayoutItem(
  layout: Layout | undefined,
  widgetId: string,
): GridItemLayout {
  const found = layout?.find((item) => item.i === widgetId);
  return found
    ? { x: found.x, y: found.y, w: found.w, h: found.h }
    : { x: 0, y: 0, w: 3, h: 2 };
}
