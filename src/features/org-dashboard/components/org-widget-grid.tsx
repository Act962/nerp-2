"use client";

import "react-grid-layout/css/styles.css";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout, ResponsiveLayouts } from "react-grid-layout";
import {
  BREAKPOINTS_WITH_LAYOUT,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  type GridBreakpoint,
  type GridItemLayout,
} from "@/features/dashboard-widgets/lib/grid-breakpoints";

// Grade de widgets de UM escopo (um painel, ou os soltos) usando
// react-grid-layout — o MESMO motor do "Meu Dashboard". Dá arrastar livre +
// alças de redimensionar quando `editable`, e respeita o layout salvo quando
// não. Cada instância é uma grade independente com sua própria largura
// (useContainerWidth), então painéis empilham sem interferir um no outro.

export interface OrgGridWidget {
  id: string;
  /** {lg,md,sm} salvos, ou null (cai no fallback). */
  layout: unknown;
  sortOrder: number;
}

export interface OrgLayoutSaveItem {
  widgetId: string;
  layout: { lg: GridItemLayout; md: GridItemLayout; sm: GridItemLayout };
  sortOrder: number;
}

/** Classe que marca a alça de arraste — o resto do card não inicia o drag. */
export const ORG_WIDGET_DRAG_HANDLE = "org-widget-drag-handle";
/** Alça de arraste do PAINEL (grade externa) — o cabeçalho do painel. */
export const ORG_PANEL_DRAG_HANDLE = "org-panel-drag-handle";

// Layout padrão de PAINEL sem posição salva: MEIA largura, 2 por linha. Cheia
// (w = cols) impedia encostar um painel no outro — não sobra espaço horizontal,
// então o grid devolvia o painel arrastado para o lugar. Meia largura deixa
// dois lado a lado de fábrica; o usuário estica/encolhe a partir daí.
export function panelDefaultItem(index: number, cols: number): GridItemLayout {
  const w = Math.max(1, Math.round(cols / 2));
  const perRow = Math.max(1, Math.floor(cols / w));
  return {
    x: (index % perRow) * w,
    y: Math.floor(index / perRow) * 6,
    w,
    h: 6,
  };
}

// Item padrão quando não há layout salvo. Widgets: 3 col × 2 linhas em fluxo
// de 4 colunas. Painéis passam o seu próprio (largura cheia, empilhado).
function fallbackItem(index: number, _cols: number): GridItemLayout {
  return { x: (index % 4) * 3, y: Math.floor(index / 4) * 2, w: 3, h: 2 };
}

function pickItem(layout: Layout | undefined, id: string): GridItemLayout {
  const found = layout?.find((item) => item.i === id);
  return found
    ? { x: found.x, y: found.y, w: found.w, h: found.h }
    : { x: 0, y: 0, w: 3, h: 2 };
}

const ALL_BREAKPOINTS = [...BREAKPOINTS_WITH_LAYOUT, "xxs"] as const;

/** Item de UM widget num breakpoint, a partir do que o SERVIDOR tem salvo (ou
 * o item padrão, para quem ainda não tem). Mobile (`xxs`) sempre usa o padrão
 * — não persiste posição própria, só empilha por sortOrder. */
function serverItem(
  breakpoint: (typeof ALL_BREAKPOINTS)[number],
  widget: OrgGridWidget,
  index: number,
  defaultItem: (index: number, cols: number) => GridItemLayout,
): GridItemLayout {
  if (breakpoint === "xxs") return defaultItem(index, 1);
  const stored = widget.layout as Record<string, GridItemLayout> | null;
  return stored?.[breakpoint] ?? defaultItem(index, GRID_COLS[breakpoint]);
}

function computeServerLayouts(
  widgets: OrgGridWidget[],
  defaultItem: (index: number, cols: number) => GridItemLayout,
): ResponsiveLayouts<GridBreakpoint> {
  const next: ResponsiveLayouts<GridBreakpoint> = {
    lg: [],
    md: [],
    sm: [],
    xxs: [],
  };
  for (const breakpoint of BREAKPOINTS_WITH_LAYOUT) {
    next[breakpoint] = widgets.map((widget, index) => ({
      i: widget.id,
      ...serverItem(breakpoint, widget, index, defaultItem),
    }));
  }
  // Mobile empilha por sortOrder, não pela ordem de chegada do array.
  let mobileY = 0;
  next.xxs = [...widgets]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((widget, index) => {
      const h = defaultItem(index, 1).h;
      const item = { i: widget.id, x: 0, y: mobileY, w: 1, h };
      mobileY += h;
      return item;
    });
  return next;
}

/**
 * Preserva a posição ATUAL (local) de cada item já conhecido e só usa o
 * layout do servidor para itens NOVOS (widget/painel recém-adicionado ou
 * recém-carregado). Chamada só quando o CONJUNTO de ids muda — nunca quando
 * apenas o CONTEÚDO (posição salva) muda — para o grid não competir com o
 * próprio usuário arrastando.
 */
function mergeNewItems(
  current: ResponsiveLayouts<GridBreakpoint>,
  widgets: OrgGridWidget[],
  defaultItem: (index: number, cols: number) => GridItemLayout,
): ResponsiveLayouts<GridBreakpoint> {
  const next: ResponsiveLayouts<GridBreakpoint> = {
    lg: [],
    md: [],
    sm: [],
    xxs: [],
  };
  for (const breakpoint of ALL_BREAKPOINTS) {
    const existingById = new Map(
      (current[breakpoint] ?? []).map((item) => [item.i, item]),
    );
    next[breakpoint] = widgets.map((widget, index) => {
      const existing = existingById.get(widget.id);
      if (existing) return existing;
      return {
        i: widget.id,
        ...serverItem(breakpoint, widget, index, defaultItem),
      };
    });
  }
  return next;
}

export function OrgWidgetGrid({
  widgets,
  editable = false,
  onSaveLayout,
  renderItem,
  dragHandleClass = ORG_WIDGET_DRAG_HANDLE,
  defaultItem = fallbackItem,
  rowHeight = GRID_ROW_HEIGHT,
  breakpoints = GRID_BREAKPOINTS,
}: {
  widgets: OrgGridWidget[];
  editable?: boolean;
  onSaveLayout?: (items: OrgLayoutSaveItem[]) => void;
  renderItem: (widgetId: string) => ReactNode;
  /** Classe da alça de arraste. O editor usa cards próprios; a view usa o
   * WidgetFrame (que traz sua própria classe). */
  dragHandleClass?: string;
  /** Layout inicial de item sem `layout` salvo. Painéis passam largura cheia. */
  defaultItem?: (index: number, cols: number) => GridItemLayout;
  /** Altura da linha do grid. Painéis usam um valor maior. */
  rowHeight?: number;
  /** Limiares de largura (px) para trocar de nº de colunas (`GRID_COLS`
   * continua fixo — só o limiar muda). Default = escala de PÁGINA
   * (`GRID_BREAKPOINTS`) — o grid de painéis usa isso, já que seu container é
   * a página inteira. Widgets DENTRO de um painel devem passar
   * `PANEL_WIDGET_BREAKPOINTS` (container bem menor que a página). */
  breakpoints?: Record<GridBreakpoint, number>;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado local: fonte de verdade do que é DESENHADO enquanto `editable`.
  // Sem isso, o layout era recomputado a partir das props do SERVIDOR em todo
  // re-render — inclusive os que nada têm a ver com o arrasto (ex.: o poll de
  // valores Oracle a cada 5s enquanto algum widget está "Calculando…"). Como
  // essas props ainda trazem a posição ANTIGA até o save + refetch
  // completarem, o grid "devolvia" o painel/widget ao lugar de antes assim
  // que qualquer coisa alheia disparava um re-render — mesmo logo após soltar
  // o arrasto. Em modo leitura (`editable=false`) não há gesto a proteger, aí
  // segue direto do servidor (reflete mudanças ao vivo normalmente).
  const [localLayouts, setLocalLayouts] = useState(() =>
    computeServerLayouts(widgets, defaultItem),
  );
  const idsSignature = widgets
    .map((widget) => widget.id)
    .sort()
    .join("|");
  const idsSignatureRef = useRef(idsSignature);

  // Só reconcilia quando o CONJUNTO de ids muda (widget/painel adicionado ou
  // removido) — nunca quando apenas o conteúdo (posição salva) muda, que é
  // exatamente o "re-render alheio" que este estado protege contra.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage só à mudança do CONJUNTO de ids (idsSignature), não ao conteúdo de `widgets`/`defaultItem` — ver comentário acima
  useEffect(() => {
    if (idsSignature === idsSignatureRef.current) return;
    idsSignatureRef.current = idsSignature;
    setLocalLayouts((current) => mergeNewItems(current, widgets, defaultItem));
  }, [idsSignature]);

  const layouts = editable
    ? localLayouts
    : computeServerLayouts(widgets, defaultItem);

  // `onLayoutChange` dispara também na MONTAGEM e a cada tick de arraste
  // (comportamento do RGL) — guardamos o mais recente num ref (barato, sem
  // re-render) e só congelamos em estado (1 re-render) e PERSISTIMOS num
  // gesto real do usuário (`onDragStop`/`onResizeStop`).
  const latestRef = useRef<ResponsiveLayouts<GridBreakpoint>>(layouts);
  useEffect(() => {
    latestRef.current = layouts;
  }, [layouts]);

  const commit = () => {
    if (!editable) return;
    setLocalLayouts(latestRef.current);
    if (!onSaveLayout) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const all = latestRef.current;
      const mobileOrder = [...(all.xxs ?? [])].sort((a, b) => a.y - b.y);
      const sortByWidget = new Map(
        mobileOrder.map((item, index) => [item.i, index]),
      );
      const payload = widgets.map((widget, index) => ({
        widgetId: widget.id,
        layout: {
          lg: pickItem(all.lg, widget.id),
          md: pickItem(all.md, widget.id),
          sm: pickItem(all.sm, widget.id),
        },
        sortOrder: sortByWidget.get(widget.id) ?? index,
      }));
      if (payload.length > 0) onSaveLayout(payload);
    }, 400);
  };

  if (widgets.length === 0) return null;

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          width={width}
          breakpoints={breakpoints}
          cols={GRID_COLS}
          layouts={layouts}
          rowHeight={rowHeight}
          margin={[12, 12]}
          dragConfig={{
            handle: `.${dragHandleClass}`,
            enabled: editable,
          }}
          resizeConfig={{ enabled: editable }}
          onLayoutChange={(_layout, all) => {
            latestRef.current = all;
          }}
          onDragStop={commit}
          onResizeStop={commit}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>{renderItem(widget.id)}</div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
