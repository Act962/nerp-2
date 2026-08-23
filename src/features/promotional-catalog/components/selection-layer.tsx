"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Copy, Move, RotateCw, Trash2 } from "lucide-react";
import { constructUrl } from "@/hooks/use-construct-url";
import type {
  CardLayoutElement,
  LayerRect,
  LayerSelection,
  Overlay,
  ProductGroup,
  StyleBlock,
  TextElement,
} from "../types";
import { ElementToolbar, type AlignEdge } from "./element-toolbar";

const CANVAS_W = 1080;
const DEFAULT_W = 260;
// Distância (px do canvas) para "grudar" um elemento numa guia de alinhamento.
const SNAP_THRESHOLD = 7;

type Box = { left: number; top: number; width: number; height: number };

// Alinhamento estilo Canva: dado o retângulo em movimento e as linhas-alvo (X e
// Y no canvas — bordas/centros da página e dos outros elementos), devolve a
// posição "grudada" na guia mais próxima (dentro do limiar) e as guias ativas.
function computeSnap(
  rect: { x: number; y: number; w: number; h: number },
  targetsX: number[],
  targetsY: number[],
): { x: number; y: number; guidesX: number[]; guidesY: number[] } {
  const movingX = [rect.x, rect.x + rect.w / 2, rect.x + rect.w];
  const movingY = [rect.y, rect.y + rect.h / 2, rect.y + rect.h];
  let bx = { d: SNAP_THRESHOLD + 1, dx: 0, guide: null as number | null };
  for (const m of movingX)
    for (const t of targetsX) {
      const dist = Math.abs(m - t);
      if (dist < bx.d) bx = { d: dist, dx: t - m, guide: t };
    }
  let by = { d: SNAP_THRESHOLD + 1, dy: 0, guide: null as number | null };
  for (const m of movingY)
    for (const t of targetsY) {
      const dist = Math.abs(m - t);
      if (dist < by.d) by = { d: dist, dy: t - m, guide: t };
    }
  return {
    x: bx.guide != null ? Math.round(rect.x + bx.dx) : rect.x,
    y: by.guide != null ? Math.round(rect.y + by.dy) : rect.y,
    guidesX: bx.guide != null ? [bx.guide] : [],
    guidesY: by.guide != null ? [by.guide] : [],
  };
}

interface SelectionLayerProps {
  // Canvas 1080×pageH renderizado (o `ref` interno do CatalogPreview), usado
  // para medir a posição real do grupo de produtos e dos cards na tela.
  previewRef: RefObject<HTMLDivElement | null>;
  // IDs dos produtos na ordem em que os cards são renderizados (para mapear
  // cada célula da grade ao produto).
  productIds: string[];
  // Layout "featured" tem um grupo com hero + subgrade — sem boxes por card.
  layoutIsFeatured: boolean;
  overlays: Overlay[];
  texts: TextElement[];
  // Blocos de estilo individuais (cards livres posicionáveis por produto).
  styleBlocks: StyleBlock[];
  selection: LayerSelection;
  onSelectionChange: (s: LayerSelection) => void;
  // Duplo clique num card na página → abre o popup do produto. Sem elemento
  // atingido → "Montar Etiqueta" (entry "label"); numa variável foto → "Editar
  // produto" (entry "photo"); numa variável de preço/texto → "Montar Etiqueta"
  // com aquele elemento selecionado (elementId).
  onEditProduct?: (
    productId: string,
    opts?: { entry?: "photo" | "label"; elementId?: string },
  ) => void;
  // Etiqueta efetiva de um produto — para saber qual variável o duplo-clique
  // atingiu dentro do card.
  cardLayoutFor?: (productId: string) => CardLayoutElement[];
  onOverlaysChange: (overlays: Overlay[]) => void;
  onTextsChange: (texts: TextElement[]) => void;
  onStyleBlocksChange: (blocks: StyleBlock[]) => void;
  // Grupo de produtos (Fase 5): retângulo salvo (px do canvas) e callback ao
  // mover/redimensionar. Ausente = ainda no fluxo padrão (deriva do DOM). Ao
  // redimensionar na Disposição personalizada, `grid` acompanha (colunas/linhas
  // recalculadas para caber mais produtos mantendo o tamanho do card).
  productGroup?: LayerRect | null;
  onGroupChange: (
    rect: LayerRect,
    opts?: {
      // Redimensionamento DINÂMICO (custom): recalcula colunas/linhas.
      grid?: { gridCols: number; gridRows: number };
      // Redimensionamento PROPORCIONAL: escala todos os elementos juntos.
      scale?: number;
    },
  ) => void;
  // Modo multi-grupo: grupos posicionáveis da página (vazio = grupo único).
  productGroups: ProductGroup[];
  onGroupsChange: (groups: ProductGroup[]) => void;
  // Duplicar/materializar grupo. No grupo único, `sourceId` vem indefinido e o
  // editor materializa a partir do retângulo medido; no multi, duplica o grupo.
  onGroupDuplicate: (
    source: { rect: LayerRect; gridCols: number; gridRows: number },
    sourceId?: string,
  ) => void;
  // Excluir um grupo (abre confirmação no editor). Sem id = grupo único.
  onGroupDelete: (id?: string) => void;
  // Disposição personalizada: colunas/linhas atuais, para o auto-ajuste da
  // grade ao redimensionar o grupo.
  layoutIsCustom: boolean;
  gridCols: number;
  gridRows: number;
  // Escala proporcional atual do grupo (modo "proporção").
  groupScale: number;
  // Altura do canvas (px) — para alinhar a etiqueta à página (barra flutuante).
  pageH: number;
}

type Drag =
  | {
      mode: "move";
      kind: "overlay" | "text";
      id: string;
      sx: number;
      sy: number;
      ox: number;
      oy: number;
      w: number;
      h: number;
      scale: number;
    }
  | {
      mode: "resize";
      id: string;
      sx: number;
      ow: number;
      ar: number;
      scale: number;
    }
  | {
      mode: "text-resize";
      id: string;
      sx: number;
      sy: number;
      ow: number;
      oh: number;
      of: number; // fontSize original — escala junto com a caixa
      scale: number;
    }
  | {
      mode: "rotate";
      kind: "overlay" | "text";
      id: string;
      cx: number;
      cy: number;
      start: number;
      orot: number;
    }
  | {
      mode: "block-move";
      id: string;
      sx: number;
      sy: number;
      ox: number;
      oy: number;
      w: number;
      h: number;
      scale: number;
    }
  | {
      mode: "block-resize";
      id: string;
      sx: number;
      sy: number;
      ow: number;
      oh: number;
      scale: number;
    }
  | {
      mode: "block-rotate";
      id: string;
      cx: number;
      cy: number;
      start: number;
      orot: number;
    }
  | {
      mode: "pgroup-move";
      id: string;
      sx: number;
      sy: number;
      base: LayerRect;
      scale: number;
    }
  | {
      mode: "pgroup-resize";
      id: string;
      sx: number;
      sy: number;
      base: LayerRect;
      cell: { w: number; h: number };
      scale: number;
    }
  | {
      mode: "group-move" | "group-resize";
      sx: number;
      sy: number;
      base: LayerRect;
      scale: number;
      // Tamanho de uma célula (px do canvas) no início do resize — usado para
      // recalcular colunas/linhas mantendo o card do mesmo tamanho (só custom).
      cell?: { w: number; h: number };
      // Escala do grupo no início — usada no modo proporção.
      baseScale?: number;
      // Modo proporção ligado no início deste arraste.
      proportional?: boolean;
    };

const inBox = (x: number, y: number, b: Box) =>
  x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;

// Camada de seleção estilo Canva — fica SOBRE o preview visível (fora do ref
// capturado no export). Dá hover + seleção nas 4 camadas: Fundo, Grupo de
// produtos, Card e Elementos (etiquetas, que mantêm mover/redimensionar/girar).
export function SelectionLayer({
  previewRef,
  productIds,
  layoutIsFeatured,
  overlays,
  texts,
  styleBlocks,
  selection,
  onSelectionChange,
  onEditProduct,
  cardLayoutFor,
  onOverlaysChange,
  onTextsChange,
  onStyleBlocksChange,
  productGroup,
  onGroupChange,
  productGroups,
  onGroupsChange,
  onGroupDuplicate,
  onGroupDelete,
  layoutIsCustom,
  gridCols,
  gridRows,
  groupScale,
  pageH,
}: SelectionLayerProps) {
  const isMulti = productGroups.length > 0;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Modo de redimensionamento do grupo: dinâmico (auto-grid) ↔ proporção (escala
  // tudo junto). Alterna ao CLICAR na alça (sem arrastar); fica azul quando ligado.
  const [proportional, setProportional] = useState(false);
  // Se o arraste do grupo (mover/redimensionar) teve movimento — senão foi só um
  // clique: seleciona o alvo (mover) ou alterna o modo da alça (redimensionar).
  const dragMoved = useRef(false);
  // O que selecionar caso o "arraste para mover" seja, na verdade, só um clique.
  const pendingSelect = useRef<LayerSelection>(null);
  const [layerW, setLayerW] = useState(0);
  const [hover, setHover] = useState<LayerSelection>(null);
  const [boxes, setBoxes] = useState<{
    group: Box | null;
    cards: { id: string; box: Box }[];
  }>({ group: null, cards: [] });
  // Guias de alinhamento (estilo Canva) exibidas durante o arraste.
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({
    x: [],
    y: [],
  });
  // Linhas-alvo (X/Y no canvas) calculadas no início de cada arraste de move.
  const snapTargets = useRef<{ tx: number[]; ty: number[] }>({
    tx: [],
    ty: [],
  });
  // Monta as linhas-alvo: bordas/centro da página + bordas/centros dos demais
  // elementos (exclui o que está sendo movido).
  const buildSnapTargets = (excludeId: string) => {
    const tx = [0, CANVAS_W / 2, CANVAS_W];
    const ty = [0, pageH / 2, pageH];
    const add = (x: number, y: number, w: number, h: number) => {
      tx.push(x, x + w / 2, x + w);
      ty.push(y, y + h / 2, y + h);
    };
    for (const o of overlays) if (o.id !== excludeId) add(o.x, o.y, o.w, o.h);
    for (const t of texts) if (t.id !== excludeId) add(t.x, t.y, t.w, t.h);
    for (const b of styleBlocks)
      if (b.id !== excludeId) add(b.x, b.y, b.w, b.h);
    snapTargets.current = { tx, ty };
  };

  const scale = layerW ? layerW / CANVAS_W : 0;
  const getScale = () =>
    ref.current ? ref.current.getBoundingClientRect().width / CANVAS_W : 1;

  // Mede grupo de produtos e cards a partir do DOM do preview, em coordenadas
  // locais da camada (para desenhar os retângulos de hover/seleção).
  const recompute = useCallback(() => {
    const layer = ref.current;
    const preview = previewRef.current;
    if (!layer || !preview) return;
    const lr = layer.getBoundingClientRect();
    const groupEl = preview.querySelector<HTMLElement>(
      '[data-role="product-group"]',
    );
    if (!groupEl) {
      setBoxes({ group: null, cards: [] });
      return;
    }
    const gr = groupEl.getBoundingClientRect();
    const group: Box = {
      left: gr.left - lr.left,
      top: gr.top - lr.top,
      width: gr.width,
      height: gr.height,
    };
    const cards: { id: string; box: Box }[] = [];
    if (!layoutIsFeatured) {
      const children = Array.from(groupEl.children) as HTMLElement[];
      children.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        cards.push({
          id: productIds[i] ?? String(i),
          box: {
            left: r.left - lr.left,
            top: r.top - lr.top,
            width: r.width,
            height: r.height,
          },
        });
      });
    }
    setBoxes({ group, cards });
  }, [previewRef, productIds, layoutIsFeatured]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setLayerW(entry.contentRect.width);
      recompute();
    });
    ro.observe(el);
    const groupEl = previewRef.current?.querySelector<HTMLElement>(
      '[data-role="product-group"]',
    );
    if (groupEl) ro.observe(groupEl);
    return () => ro.disconnect();
  }, [recompute, previewRef]);

  // Recalcula ao mudar seleção/produtos/escala e em scroll/resize da janela.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recálculo intencional em escala/seleção/nº de etiquetas
  useEffect(() => {
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [recompute, scale, selection, overlays.length]);

  // ── Etiquetas (overlays): mover / redimensionar / girar / excluir ──
  const update = (id: string, patch: Partial<Overlay>) =>
    onOverlaysChange(
      overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    );

  const removeOverlay = (id: string) => {
    onOverlaysChange(overlays.filter((o) => o.id !== id));
    onSelectionChange(null);
  };

  // ── Textos: mover / redimensionar / girar / excluir ──
  const updateText = (id: string, patch: Partial<TextElement>) =>
    onTextsChange(texts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeText = (id: string) => {
    onTextsChange(texts.filter((t) => t.id !== id));
    onSelectionChange(null);
  };

  // ── Blocos de estilo: mover / redimensionar / girar / excluir ──
  const updateBlock = (id: string, patch: Partial<StyleBlock>) =>
    onStyleBlocksChange(
      styleBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );

  const removeBlock = (id: string) => {
    onStyleBlocksChange(styleBlocks.filter((b) => b.id !== id));
    onSelectionChange(null);
  };

  // Tecla Delete/Backspace exclui o item selecionado (mesma ação dos botões de
  // lixeira). Só o SelectionLayer da página ativa tem `selection` != null.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fecha sobre arrays atuais
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (selection.kind === "element") {
        e.preventDefault();
        removeOverlay(selection.id);
      } else if (selection.kind === "text") {
        e.preventDefault();
        removeText(selection.id);
      } else if (selection.kind === "styleBlock") {
        e.preventDefault();
        removeBlock(selection.id);
      } else if (selection.kind === "group") {
        e.preventDefault();
        onGroupDelete(selection.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, overlays, texts, styleBlocks, onGroupDelete]);

  // ── Grupos de produtos (multi): mover / redimensionar / excluir ──
  const updateGroup = (id: string, patch: Partial<ProductGroup>) =>
    onGroupsChange(
      productGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      const rawX = Math.round(d.ox + (e.clientX - d.sx) / d.scale);
      const rawY = Math.round(d.oy + (e.clientY - d.sy) / d.scale);
      const snap = computeSnap(
        { x: rawX, y: rawY, w: d.w, h: d.h },
        snapTargets.current.tx,
        snapTargets.current.ty,
      );
      setGuides({ x: snap.guidesX, y: snap.guidesY });
      const upd = d.kind === "text" ? updateText : update;
      upd(d.id, { x: snap.x, y: snap.y });
    } else if (d.mode === "resize") {
      const w = Math.max(24, Math.round(d.ow + (e.clientX - d.sx) / d.scale));
      update(d.id, { w, h: Math.round(w / d.ar) });
    } else if (d.mode === "text-resize") {
      // Escala proporcional (estilo Canva): a fonte cresce/encolhe junto com a
      // caixa, mantendo a proporção — o texto sempre cabe.
      const w = Math.max(60, Math.round(d.ow + (e.clientX - d.sx) / d.scale));
      const factor = w / d.ow;
      updateText(d.id, {
        w,
        h: Math.max(40, Math.round(d.oh * factor)),
        fontSize: Math.max(8, Math.round(d.of * factor)),
      });
    } else if (d.mode === "rotate") {
      const upd = d.kind === "text" ? updateText : update;
      const angle =
        (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
      upd(d.id, { rotation: Math.round(d.orot + (angle - d.start)) });
    } else if (d.mode === "block-move") {
      const rawX = Math.round(d.ox + (e.clientX - d.sx) / d.scale);
      const rawY = Math.round(d.oy + (e.clientY - d.sy) / d.scale);
      const snap = computeSnap(
        { x: rawX, y: rawY, w: d.w, h: d.h },
        snapTargets.current.tx,
        snapTargets.current.ty,
      );
      setGuides({ x: snap.guidesX, y: snap.guidesY });
      updateBlock(d.id, { x: snap.x, y: snap.y });
    } else if (d.mode === "block-resize") {
      // Redimensiona livre (largura/altura independentes) — o card livre
      // escala suas fontes pela altura, então cabe em qualquer proporção.
      updateBlock(d.id, {
        w: Math.max(80, Math.round(d.ow + (e.clientX - d.sx) / d.scale)),
        h: Math.max(80, Math.round(d.oh + (e.clientY - d.sy) / d.scale)),
      });
    } else if (d.mode === "block-rotate") {
      const angle =
        (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI;
      updateBlock(d.id, { rotation: Math.round(d.orot + (angle - d.start)) });
    } else if (d.mode === "pgroup-move") {
      updateGroup(d.id, {
        rect: {
          ...d.base,
          x: Math.round(d.base.x + (e.clientX - d.sx) / d.scale),
          y: Math.round(d.base.y + (e.clientY - d.sy) / d.scale),
        },
      });
    } else if (d.mode === "pgroup-resize") {
      const dx = (e.clientX - d.sx) / d.scale;
      const dy = (e.clientY - d.sy) / d.scale;
      const w = Math.max(120, Math.round(d.base.w + dx));
      const h = Math.max(120, Math.round(d.base.h + dy));
      // Auto-grade: colunas/linhas seguem o tamanho da célula fixado no início —
      // a caixa cresce, mais produtos cabem e aparecem (igual ao grupo único).
      updateGroup(d.id, {
        rect: { ...d.base, w, h },
        gridCols: Math.min(8, Math.max(1, Math.round(w / d.cell.w))),
        gridRows: Math.min(12, Math.max(1, Math.round(h / d.cell.h))),
      });
    } else if (d.mode === "group-move") {
      // Só passa a mover depois de sair do limiar (evita mover num clique). Ao
      // começar a mover, seleciona o grupo.
      if (Math.abs(e.clientX - d.sx) > 3 || Math.abs(e.clientY - d.sy) > 3) {
        if (!dragMoved.current) {
          dragMoved.current = true;
          onSelectionChange({ kind: "group" });
        }
      }
      if (dragMoved.current) {
        onGroupChange({
          ...d.base,
          x: Math.round(d.base.x + (e.clientX - d.sx) / d.scale),
          y: Math.round(d.base.y + (e.clientY - d.sy) / d.scale),
        });
      }
    } else if (d.mode === "group-resize") {
      const dx = (e.clientX - d.sx) / d.scale;
      const dy = (e.clientY - d.sy) / d.scale;
      if (Math.abs(e.clientX - d.sx) > 3 || Math.abs(e.clientY - d.sy) > 3) {
        dragMoved.current = true;
      }
      if (d.proportional) {
        // Modo proporção: mantém a caixa; escala TODOS os elementos juntos.
        // A escala segue o arraste horizontal (proporcional à largura base).
        const baseScale = d.baseScale ?? 1;
        const next = baseScale + dx / d.base.w;
        const scaleVal = Math.min(
          5,
          Math.max(0.2, Math.round(next * 100) / 100),
        );
        onGroupChange({ ...d.base }, { scale: scaleVal });
      } else {
        // Clampa aos limites da página (1080×pageH): sem isso, crescer para a
        // direita/baixo estoura a borda e o excesso é CORTADO (overflow) — dando
        // a impressão de que só estica para baixo. Assim o resize horizontal fica
        // sempre visível, até a borda da página.
        const maxW = Math.max(120, CANVAS_W - d.base.x);
        const maxH = Math.max(120, pageH - d.base.y);
        const w = Math.max(120, Math.min(maxW, Math.round(d.base.w + dx)));
        const h = Math.max(120, Math.min(maxH, Math.round(d.base.h + dy)));
        // Auto-ajuste da grade (custom): as colunas/linhas seguem o tamanho do
        // card fixado no início — a caixa cresce, mais produtos cabem e aparecem.
        const grid = d.cell
          ? {
              gridCols: Math.min(8, Math.max(1, Math.round(w / d.cell.w))),
              gridRows: Math.min(12, Math.max(1, Math.round(h / d.cell.h))),
            }
          : undefined;
        onGroupChange({ ...d.base, w, h }, grid ? { grid } : undefined);
      }
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d?.mode === "group-resize" && !dragMoved.current) {
      // Clicar na alça (sem arrastar) alterna dinâmico ↔ proporção.
      setProportional((v) => !v);
    } else if (d?.mode === "group-move" && !dragMoved.current) {
      // Foi só um clique dentro do grupo → seleciona o alvo (card ou grupo).
      onSelectionChange(pendingSelect.current);
    }
    pendingSelect.current = null;
    drag.current = null;
    setGuides({ x: [], y: [] });
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const beginDrag = (d: Drag) => {
    drag.current = d;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startMove = (e: React.PointerEvent, ov: Overlay) => {
    e.stopPropagation();
    onSelectionChange({ kind: "element", id: ov.id });
    buildSnapTargets(ov.id);
    beginDrag({
      mode: "move",
      kind: "overlay",
      id: ov.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: ov.x,
      oy: ov.y,
      w: ov.w,
      h: ov.h,
      scale: getScale(),
    });
  };

  const startResize = (e: React.PointerEvent, ov: Overlay) => {
    e.stopPropagation();
    onSelectionChange({ kind: "element", id: ov.id });
    beginDrag({
      mode: "resize",
      id: ov.id,
      sx: e.clientX,
      ow: ov.w,
      ar: ov.w / ov.h || 1,
      scale: getScale(),
    });
  };

  const startRotate = (e: React.PointerEvent, ov: Overlay) => {
    e.stopPropagation();
    onSelectionChange({ kind: "element", id: ov.id });
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = r.width / CANVAS_W;
    const cx = r.left + (ov.x + ov.w / 2) * s;
    const cy = r.top + (ov.y + ov.h / 2) * s;
    const start = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    beginDrag({
      mode: "rotate",
      kind: "overlay",
      id: ov.id,
      cx,
      cy,
      start,
      orot: ov.rotation,
    });
  };

  // ── Textos: mesmos gestos (mover/redimensionar/girar) ──
  const startTextMove = (e: React.PointerEvent, t: TextElement) => {
    e.stopPropagation();
    onSelectionChange({ kind: "text", id: t.id });
    buildSnapTargets(t.id);
    beginDrag({
      mode: "move",
      kind: "text",
      id: t.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: t.x,
      oy: t.y,
      w: t.w,
      h: t.h,
      scale: getScale(),
    });
  };

  const startTextResize = (e: React.PointerEvent, t: TextElement) => {
    e.stopPropagation();
    onSelectionChange({ kind: "text", id: t.id });
    beginDrag({
      mode: "text-resize",
      id: t.id,
      sx: e.clientX,
      sy: e.clientY,
      ow: t.w,
      oh: t.h,
      of: t.fontSize,
      scale: getScale(),
    });
  };

  const startTextRotate = (e: React.PointerEvent, t: TextElement) => {
    e.stopPropagation();
    onSelectionChange({ kind: "text", id: t.id });
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = r.width / CANVAS_W;
    const cx = r.left + (t.x + t.w / 2) * s;
    const cy = r.top + (t.y + t.h / 2) * s;
    const start = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    beginDrag({
      mode: "rotate",
      kind: "text",
      id: t.id,
      cx,
      cy,
      start,
      orot: t.rotation,
    });
  };

  // ── Blocos de estilo: mesmos gestos (mover/redimensionar/girar) ──
  const startBlockMove = (e: React.PointerEvent, b: StyleBlock) => {
    e.stopPropagation();
    onSelectionChange({ kind: "styleBlock", id: b.id });
    buildSnapTargets(b.id);
    beginDrag({
      mode: "block-move",
      id: b.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: b.x,
      oy: b.y,
      w: b.w,
      h: b.h,
      scale: getScale(),
    });
  };

  const startBlockResize = (e: React.PointerEvent, b: StyleBlock) => {
    e.stopPropagation();
    onSelectionChange({ kind: "styleBlock", id: b.id });
    beginDrag({
      mode: "block-resize",
      id: b.id,
      sx: e.clientX,
      sy: e.clientY,
      ow: b.w,
      oh: b.h,
      scale: getScale(),
    });
  };

  const startBlockRotate = (e: React.PointerEvent, b: StyleBlock) => {
    e.stopPropagation();
    onSelectionChange({ kind: "styleBlock", id: b.id });
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = r.width / CANVAS_W;
    const cx = r.left + (b.x + b.w / 2) * s;
    const cy = r.top + (b.y + b.h / 2) * s;
    const start = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    beginDrag({
      mode: "block-rotate",
      id: b.id,
      cx,
      cy,
      start,
      orot: b.rotation,
    });
  };

  // ── Grupos de produtos (multi): mover / redimensionar ──
  const startPGroupMove = (e: React.PointerEvent, g: ProductGroup) => {
    e.stopPropagation();
    onSelectionChange({ kind: "group", id: g.id });
    beginDrag({
      mode: "pgroup-move",
      id: g.id,
      sx: e.clientX,
      sy: e.clientY,
      base: g.rect,
      scale: getScale(),
    });
  };

  const startPGroupResize = (e: React.PointerEvent, g: ProductGroup) => {
    e.stopPropagation();
    onSelectionChange({ kind: "group", id: g.id });
    beginDrag({
      mode: "pgroup-resize",
      id: g.id,
      sx: e.clientX,
      sy: e.clientY,
      base: g.rect,
      cell: {
        w: g.rect.w / Math.max(1, g.gridCols),
        h: g.rect.h / Math.max(1, g.gridRows),
      },
      scale: getScale(),
    });
  };

  // Retângulo atual do grupo em px do canvas: usa o salvo ou deriva do DOM.
  const currentGroupRect = (): LayerRect | null => {
    if (productGroup) return productGroup;
    if (boxes.group && scale > 0) {
      return {
        x: Math.round(boxes.group.left / scale),
        y: Math.round(boxes.group.top / scale),
        w: Math.round(boxes.group.width / scale),
        h: Math.round(boxes.group.height / scale),
      };
    }
    return null;
  };

  const startGroupMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    const base = currentGroupRect();
    if (!base) return;
    onSelectionChange({ kind: "group" });
    pendingSelect.current = { kind: "group" };
    dragMoved.current = false;
    beginDrag({
      mode: "group-move",
      sx: e.clientX,
      sy: e.clientY,
      base,
      scale: getScale(),
    });
  };

  const startGroupResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    const base = currentGroupRect();
    if (!base) return;
    onSelectionChange({ kind: "group" });
    // Só a Disposição personalizada tem grade dirigida por colunas/linhas; nela,
    // fixamos o tamanho da célula atual para recalcular a grade ao arrastar.
    const cell = layoutIsCustom
      ? {
          w: base.w / Math.max(1, gridCols),
          h: base.h / Math.max(1, gridRows),
        }
      : undefined;
    dragMoved.current = false;
    beginDrag({
      mode: "group-resize",
      sx: e.clientX,
      sy: e.clientY,
      base,
      scale: getScale(),
      cell,
      baseScale: groupScale,
      proportional,
    });
  };

  // Solta uma etiqueta arrastada da biblioteca.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const assetKey = e.dataTransfer.getData("text/plain");
    if (!assetKey) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = r.width / CANVAS_W;
    const cx = (e.clientX - r.left) / s;
    const cy = (e.clientY - r.top) / s;
    // Cria o overlay com a proporção da imagem; se a imagem falhar ao carregar
    // (bucket fora do ar/offline), cai num quadrado padrão em vez de sumir.
    const place = (ar: number) => {
      const w = DEFAULT_W;
      const h = Math.round(w / (ar || 1));
      const ov: Overlay = {
        id: crypto.randomUUID(),
        assetKey,
        x: Math.round(cx - w / 2),
        y: Math.round(cy - h / 2),
        w,
        h,
        rotation: 0,
      };
      onOverlaysChange([...overlays, ov]);
      onSelectionChange({ kind: "element", id: ov.id });
    };
    const img = new Image();
    img.onload = () => place(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => place(1);
    img.src = constructUrl(assetKey);
  };

  // ── Hit-test do hover (card > grupo > fundo) ──
  const hitTest = (clientX: number, clientY: number): LayerSelection => {
    const layer = ref.current;
    if (!layer) return { kind: "background" };
    // Modo multi-grupo: a seleção/mover/redimensionar de cada grupo vem das
    // próprias molduras (divs interativas), não do hit-test do grupo único.
    if (isMulti) return { kind: "background" };
    const lr = layer.getBoundingClientRect();
    const x = clientX - lr.left;
    const y = clientY - lr.top;
    for (const c of boxes.cards) {
      if (inBox(x, y, c.box)) return { kind: "card", id: c.id };
    }
    if (boxes.group && inBox(x, y, boxes.group)) return { kind: "group" };
    return { kind: "background" };
  };

  const onLayerMove = (e: React.PointerEvent) => {
    // No multi-grupo o hover é gerido pelas molduras (onPointerEnter/Leave);
    // deixar o hit-test do grupo único aqui só causaria flicker.
    if (drag.current || isMulti) return;
    setHover(hitTest(e.clientX, e.clientY));
  };

  // Duplo clique num card → abre o popup do produto, roteando pela variável
  // atingida: foto → "Editar produto"; preço/texto (qualquer elemento) →
  // "Montar Etiqueta" com o elemento selecionado; vazio → "Montar Etiqueta".
  const onLayerDoubleClick = (e: React.MouseEvent) => {
    const layer = ref.current;
    if (!layer) return;
    const lr = layer.getBoundingClientRect();
    const x = e.clientX - lr.left;
    const y = e.clientY - lr.top;
    const card = boxes.cards.find((c) => inBox(x, y, c.box));
    if (!card?.id) return;
    // Fração do ponto DENTRO da célula do card → acha o elemento no topo (z).
    const layout = cardLayoutFor?.(card.id) ?? [];
    const fx = (x - card.box.left) / card.box.width;
    const fy = (y - card.box.top) / card.box.height;
    const el = [...layout]
      .sort((a, b) => (b.z ?? 0) - (a.z ?? 0))
      .find(
        (le) =>
          fx >= le.x && fx <= le.x + le.w && fy >= le.y && fy <= le.y + le.h,
      );
    if (el?.kind === "var" && el.variable === "photo")
      onEditProduct?.(card.id, { entry: "photo" });
    else if (el) onEditProduct?.(card.id, { entry: "label", elementId: el.id });
    else onEditProduct?.(card.id, { entry: "label" });
  };

  const onLayerDown = (e: React.PointerEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    // Com o grupo JÁ selecionado (grupo ou um card dele), um pointerdown dentro
    // do grupo inicia um arraste PENDENTE: se o ponteiro se mover, MOVE o grupo
    // inteiro (de qualquer ponto); se for só clique, seleciona o alvo (card →
    // abre a aba Produtos com contorno; ou o grupo). Quando o grupo ainda não
    // está selecionado, o clique seleciona direto (sem risco de mover sem querer).
    const groupSelected =
      selection?.kind === "group" || selection?.kind === "card";
    if (groupSelected && (hit?.kind === "card" || hit?.kind === "group")) {
      const base = currentGroupRect();
      if (base) {
        pendingSelect.current = hit;
        dragMoved.current = false;
        beginDrag({
          mode: "group-move",
          sx: e.clientX,
          sy: e.clientY,
          base,
          scale: getScale(),
        });
        return;
      }
    }
    onSelectionChange(hit);
  };

  const px = (v: number) => v * scale;

  const outline = (kind: "hover" | "selected") =>
    kind === "selected"
      ? "2px solid var(--color-primary, #2563eb)"
      : "1.5px dashed color-mix(in srgb, var(--color-primary, #2563eb) 55%, transparent)";

  const selKind = selection?.kind;
  const selId =
    selection && "id" in selection ? (selection as { id: string }).id : null;
  const hovKind = hover?.kind;
  const hovId = hover && "id" in hover ? (hover as { id: string }).id : null;

  // O quadro do Grupo (com alças de mover/redimensionar) aparece tanto quando o
  // próprio grupo está selecionado quanto quando um CARD dele está — assim dá
  // para redimensionar o bloco sem sair do produto selecionado.
  const groupState =
    selKind === "group" || selKind === "card"
      ? "selected"
      : hovKind === "group"
        ? "hover"
        : null;

  // ── Barra flutuante do elemento (etiqueta) selecionado ──
  const selOverlayIndex =
    selKind === "element" ? overlays.findIndex((o) => o.id === selId) : -1;
  const selOverlay = selOverlayIndex >= 0 ? overlays[selOverlayIndex] : null;

  const duplicateSelOverlay = () => {
    if (!selOverlay) return;
    const copy: Overlay = {
      ...selOverlay,
      id: crypto.randomUUID(),
      x: selOverlay.x + 24,
      y: selOverlay.y + 24,
    };
    const next = [...overlays];
    next.splice(selOverlayIndex + 1, 0, copy);
    onOverlaysChange(next);
    onSelectionChange({ kind: "element", id: copy.id });
  };

  const reorderSelOverlay = (dir: 1 | -1) => {
    const to = selOverlayIndex + dir;
    if (selOverlayIndex < 0 || to < 0 || to >= overlays.length) return;
    const next = [...overlays];
    const [moved] = next.splice(selOverlayIndex, 1);
    next.splice(to, 0, moved);
    onOverlaysChange(next);
  };

  const alignSelOverlay = (edge: AlignEdge) => {
    if (!selOverlay) return;
    const patch: Partial<Overlay> = {};
    if (edge === "left") patch.x = 0;
    else if (edge === "hcenter")
      patch.x = Math.round((CANVAS_W - selOverlay.w) / 2);
    else if (edge === "right") patch.x = CANVAS_W - selOverlay.w;
    else if (edge === "top") patch.y = 0;
    else if (edge === "vcenter")
      patch.y = Math.round((pageH - selOverlay.h) / 2);
    else if (edge === "bottom") patch.y = pageH - selOverlay.h;
    update(selOverlay.id, patch);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: camada de canvas (seleção/arrastar etiquetas)
    <div
      ref={ref}
      className="absolute inset-0"
      style={{
        cursor:
          groupState === "selected" &&
          (hovKind === "group" || hovKind === "card")
            ? "move"
            : undefined,
      }}
      onPointerDown={onLayerDown}
      onPointerMove={onLayerMove}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onLayerDoubleClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Guias de alinhamento (estilo Canva) — linhas durante o arraste */}
      {scale > 0 &&
        guides.x.map((gx) => (
          <div
            key={`gx-${gx}`}
            className="pointer-events-none absolute bottom-0 top-0 z-20"
            style={{
              left: px(gx),
              width: 1,
              backgroundColor: "var(--color-primary, #2563eb)",
            }}
          />
        ))}
      {scale > 0 &&
        guides.y.map((gy) => (
          <div
            key={`gy-${gy}`}
            className="pointer-events-none absolute left-0 right-0 z-20"
            style={{
              top: px(gy),
              height: 1,
              backgroundColor: "var(--color-primary, #2563eb)",
            }}
          />
        ))}

      {/* Retângulo do Grupo de produtos (modo grupo único) */}
      {!isMulti && boxes.group && groupState && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: boxes.group.left,
            top: boxes.group.top,
            width: boxes.group.width,
            height: boxes.group.height,
            outline: outline(groupState),
            outlineOffset: 4,
            borderRadius: 6,
          }}
        >
          {groupState === "selected" && (
            <>
              {/* Rótulo = alça de mover o grupo inteiro */}
              <button
                type="button"
                title="Arraste para mover o grupo"
                className="pointer-events-auto absolute -top-6 left-0 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                style={{ cursor: "move" }}
                onPointerDown={startGroupMove}
              >
                <Move className="h-3 w-3" />
                Grupo de produtos
              </button>
              {/* Duplicar (materializa 2 grupos) + Excluir (com confirmação) */}
              <div className="pointer-events-auto absolute -top-6 right-0 flex items-center gap-1">
                <button
                  type="button"
                  title="Duplicar grupo de produtos"
                  className="flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const base = currentGroupRect();
                    if (base)
                      onGroupDuplicate({ rect: base, gridCols, gridRows });
                  }}
                >
                  <Copy className="h-3 w-3" />
                  Duplicar
                </button>
                <button
                  type="button"
                  title="Excluir grupo de produtos"
                  className="flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onGroupDelete();
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </button>
              </div>
              {/* Alça de redimensionar (canto inferior direito). Clicar (sem
                  arrastar) alterna: dinâmico (branca) ↔ proporção (azul). */}
              <button
                type="button"
                title={
                  proportional
                    ? "Proporção: tudo escala junto (clique para dinâmico)"
                    : "Dinâmico: ajusta colunas/linhas (clique para proporção)"
                }
                className={`pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-primary ${
                  proportional ? "bg-primary" : "bg-background"
                }`}
                style={{ cursor: "nwse-resize" }}
                onPointerDown={startGroupResize}
              />
            </>
          )}
        </div>
      )}

      {/* Molduras dos grupos de produtos (modo multi-grupo) — mover / auto-grade
          ao redimensionar / duplicar / excluir, a partir dos retângulos salvos. */}
      {scale > 0 &&
        isMulti &&
        productGroups.map((g, gi) => {
          const selected = selKind === "group" && selId === g.id;
          const hovered = hovKind === "group" && hovId === g.id;
          return (
            <div
              key={g.id}
              className="absolute"
              style={{
                left: px(g.rect.x),
                top: px(g.rect.y),
                width: px(g.rect.w),
                height: px(g.rect.h),
                outline: selected
                  ? outline("selected")
                  : hovered
                    ? outline("hover")
                    : undefined,
                outlineOffset: 4,
                borderRadius: 6,
                cursor: "move",
              }}
              onPointerEnter={() => setHover({ kind: "group", id: g.id })}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => startPGroupMove(e, g)}
            >
              {selected && (
                <>
                  <span
                    className="pointer-events-none absolute -top-6 left-0 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                    style={{ cursor: "move" }}
                  >
                    <Move className="h-3 w-3" />
                    Grupo {gi + 1}
                  </span>
                  <button
                    type="button"
                    title="Duplicar grupo"
                    className="absolute -top-6 right-8 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onGroupDuplicate(
                        {
                          rect: g.rect,
                          gridCols: g.gridCols,
                          gridRows: g.gridRows,
                        },
                        g.id,
                      );
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Excluir grupo"
                    className="absolute -top-6 right-0 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onGroupDelete(g.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Redimensionar (ajusta colunas/linhas)"
                    className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-primary bg-background"
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => startPGroupResize(e, g)}
                  />
                </>
              )}
            </div>
          );
        })}

      {/* Retângulos por Card (só no modo grupo único) */}
      {!isMulti &&
        boxes.cards.map((c) => {
          const state =
            selKind === "card" && selId === c.id
              ? "selected"
              : hovKind === "card" && hovId === c.id
                ? "hover"
                : null;
          if (!state) return null;
          return (
            <div
              key={c.id}
              className="pointer-events-none absolute"
              style={{
                left: c.box.left,
                top: c.box.top,
                width: c.box.width,
                height: c.box.height,
                outline: outline(state),
                outlineOffset: 2,
                borderRadius: 6,
              }}
            />
          );
        })}

      {/* Etiquetas (Elementos) — nós de mover/redimensionar/girar/excluir */}
      {scale > 0 &&
        overlays.map((ov) => {
          const selected = selKind === "element" && selId === ov.id;
          return (
            <div
              key={ov.id}
              className="absolute"
              style={{
                left: px(ov.x),
                top: px(ov.y),
                width: px(ov.w),
                height: px(ov.h),
                transform: ov.rotation
                  ? `rotate(${ov.rotation}deg)`
                  : undefined,
                outline: selected
                  ? outline("selected")
                  : hovKind === "element" && hovId === ov.id
                    ? outline("hover")
                    : undefined,
                cursor: "move",
              }}
              onPointerEnter={() => setHover({ kind: "element", id: ov.id })}
              onPointerDown={(e) => startMove(e, ov)}
            >
              {selected && (
                <>
                  <button
                    type="button"
                    className="absolute left-1/2 -top-7 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-foreground shadow"
                    title="Girar"
                    onPointerDown={(e) => startRotate(e, ov)}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-destructive shadow"
                    title="Excluir etiqueta"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      removeOverlay(ov.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border-2 border-primary bg-background"
                    style={{ cursor: "nwse-resize" }}
                    title="Redimensionar"
                    onPointerDown={(e) => startResize(e, ov)}
                  />
                </>
              )}
            </div>
          );
        })}

      {/* Textos — nós de mover/redimensionar/girar/excluir. O texto em si é
          desenhado pelo CatalogPreview embaixo; aqui vão só as alças. */}
      {scale > 0 &&
        texts.map((t) => {
          const selected = selKind === "text" && selId === t.id;
          return (
            <div
              key={t.id}
              className="absolute"
              style={{
                left: px(t.x),
                top: px(t.y),
                width: px(t.w),
                height: px(t.h),
                transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
                outline: selected
                  ? outline("selected")
                  : hovKind === "text" && hovId === t.id
                    ? outline("hover")
                    : undefined,
                cursor: "move",
              }}
              onPointerEnter={() => setHover({ kind: "text", id: t.id })}
              onPointerDown={(e) => startTextMove(e, t)}
            >
              {selected && (
                <>
                  <button
                    type="button"
                    className="absolute left-1/2 -top-7 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-foreground shadow"
                    title="Girar"
                    onPointerDown={(e) => startTextRotate(e, t)}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-destructive shadow"
                    title="Excluir texto"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      removeText(t.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border-2 border-primary bg-background"
                    style={{ cursor: "nwse-resize" }}
                    title="Redimensionar"
                    onPointerDown={(e) => startTextResize(e, t)}
                  />
                </>
              )}
            </div>
          );
        })}

      {/* Blocos de estilo — nós de mover/redimensionar/girar/excluir. O card
          em si é desenhado pelo CatalogPreview embaixo; aqui vão só as alças. */}
      {scale > 0 &&
        styleBlocks.map((b) => {
          const selected = selKind === "styleBlock" && selId === b.id;
          return (
            <div
              key={b.id}
              className="absolute"
              style={{
                left: px(b.x),
                top: px(b.y),
                width: px(b.w),
                height: px(b.h),
                transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                outline: selected
                  ? outline("selected")
                  : hovKind === "styleBlock" && hovId === b.id
                    ? outline("hover")
                    : undefined,
                cursor: "move",
              }}
              onPointerEnter={() => setHover({ kind: "styleBlock", id: b.id })}
              onPointerDown={(e) => startBlockMove(e, b)}
            >
              {selected && (
                <>
                  <button
                    type="button"
                    className="absolute left-1/2 -top-7 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-foreground shadow"
                    title="Girar"
                    onPointerDown={(e) => startBlockRotate(e, b)}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-destructive shadow"
                    title="Excluir bloco"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      removeBlock(b.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm border-2 border-primary bg-background"
                    style={{ cursor: "nwse-resize" }}
                    title="Redimensionar"
                    onPointerDown={(e) => startBlockResize(e, b)}
                  />
                </>
              )}
            </div>
          );
        })}

      {/* Barra flutuante do elemento selecionado (estilo Canva). Fica acima da
          etiqueta; se não couber no topo, vai para baixo dela. */}
      {scale > 0 && selOverlay && (
        <div
          className="absolute z-10"
          style={{
            left: px(selOverlay.x),
            top:
              px(selOverlay.y) - 48 < 0
                ? px(selOverlay.y) + px(selOverlay.h) + 8
                : px(selOverlay.y) - 48,
          }}
        >
          <ElementToolbar
            overlay={selOverlay}
            onChange={(patch) => update(selOverlay.id, patch)}
            onDuplicate={duplicateSelOverlay}
            onDelete={() => removeOverlay(selOverlay.id)}
            onBringForward={() => reorderSelOverlay(1)}
            onSendBackward={() => reorderSelOverlay(-1)}
            canForward={selOverlayIndex < overlays.length - 1}
            canBackward={selOverlayIndex > 0}
            onAlign={alignSelOverlay}
          />
        </div>
      )}
    </div>
  );
}
