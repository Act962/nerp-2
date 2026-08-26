"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Badge,
  Barcode,
  Bold,
  BoxSelect,
  Circle,
  Coins,
  DollarSign,
  FolderTree,
  Image as ImageIcon,
  Minus,
  PiggyBank,
  Percent,
  Plus,
  Ruler,
  Save,
  Square,
  Tag,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CARD_VARIABLES,
  type CardLayoutElement,
  type CardVariable,
  type CatalogProduct,
  TEXT_FONTS,
  makeCardElement,
} from "../types";
import {
  type CropRect,
  type PageBgConfig,
  pageWindowBg,
} from "../lib/background-presets";
import { CardFreeLayout } from "./cards/card-free-layout";

// Ícone por variável — paleta mais intuitiva.
const VAR_ICONS: Record<CardVariable, LucideIcon> = {
  photo: ImageIcon,
  name: Type,
  priceActive: DollarSign,
  priceCurrency: Badge,
  priceReais: Coins,
  priceCents: Coins,
  priceFrom: Tag,
  unit: Ruler,
  sku: Barcode,
  discountPct: Percent,
  savings: PiggyBank,
  category: FolderTree,
};

type Drag =
  | {
      mode: "move";
      sx: number;
      sy: number;
      items: { id: string; ox: number; oy: number }[];
    }
  | {
      mode: "resize";
      id: string;
      sx: number;
      sy: number;
      ow: number;
      oh: number;
    };

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

// Que preço uma variável representa, para edição inline na etiqueta:
// "offer" = preço em destaque/ativo ("Por"); "normal" = "De" riscado.
function priceKindOf(
  variable: CardVariable | undefined,
): "offer" | "normal" | null {
  if (variable === "priceFrom") return "normal";
  if (
    variable === "priceActive" ||
    variable === "priceReais" ||
    variable === "priceCents" ||
    variable === "priceCurrency"
  )
    return "offer";
  return null;
}

// Nós de dimensionamento do card — DENTRO do preview (inset da borda), nos 4
// cantos + meios das 4 bordas. Arrastar muda a proporção (largura/altura):
// bordas verticais mexem na altura, horizontais na largura, cantos nas duas.
const HANDLE_INSET = 10;
type ResizeHandle = {
  key: string;
  dir: { x: number; y: number };
  pos: React.CSSProperties;
  cursor: string;
};
const RESIZE_HANDLES: ResizeHandle[] = [
  {
    key: "tl",
    dir: { x: -1, y: -1 },
    pos: { left: HANDLE_INSET, top: HANDLE_INSET },
    cursor: "nwse-resize",
  },
  {
    key: "tc",
    dir: { x: 0, y: -1 },
    pos: { left: "50%", top: HANDLE_INSET, transform: "translateX(-50%)" },
    cursor: "ns-resize",
  },
  {
    key: "tr",
    dir: { x: 1, y: -1 },
    pos: { right: HANDLE_INSET, top: HANDLE_INSET },
    cursor: "nesw-resize",
  },
  {
    key: "ml",
    dir: { x: -1, y: 0 },
    pos: { left: HANDLE_INSET, top: "50%", transform: "translateY(-50%)" },
    cursor: "ew-resize",
  },
  {
    key: "mr",
    dir: { x: 1, y: 0 },
    pos: { right: HANDLE_INSET, top: "50%", transform: "translateY(-50%)" },
    cursor: "ew-resize",
  },
  {
    key: "bl",
    dir: { x: -1, y: 1 },
    pos: { left: HANDLE_INSET, bottom: HANDLE_INSET },
    cursor: "nesw-resize",
  },
  {
    key: "bc",
    dir: { x: 0, y: 1 },
    pos: { left: "50%", bottom: HANDLE_INSET, transform: "translateX(-50%)" },
    cursor: "ns-resize",
  },
  {
    key: "br",
    dir: { x: 1, y: 1 },
    pos: { right: HANDLE_INSET, bottom: HANDLE_INSET },
    cursor: "nwse-resize",
  },
];

interface CardFreeEditorProps {
  elements: CardLayoutElement[];
  onElementsChange: (elements: CardLayoutElement[]) => void;
  product: CatalogProduct;
  // Voltar/fechar o editor (botão no canto + também exposto no rodapé do modal).
  onClose?: () => void;
  // Elemento pré-selecionado ao abrir (duplo-clique numa variável na página):
  // seleciona e foca a edição. Texto → foca o input de texto.
  initialSelectedId?: string;
  // Duplo-clique na variável FOTO → abre "Editar produto" (gestão de imagem).
  onEditPhoto?: () => void;
  // Editar o PREÇO direto na etiqueta (duplo-clique numa variável de preço):
  // "offer" = preço ativo/"Por" (offerOverrides); "normal" = "De" riscado
  // (priceOverrides). Grava no catálogo, não no cadastro. null = limpar.
  onSetPrice?: (which: "offer" | "normal", value: number | null) => void;
  canManageSystem: boolean;
  // Salvar como NOVO estilo na biblioteca (modo criação). Oculto no modo edição.
  onSaveStyle?: (name: string, scope: "USER" | "SYSTEM") => void;
  hideSave?: boolean;
  // Altura do card: proporção largura/altura (default 1 = quadrado). Quando
  // `onCardAspectChange` é passado, mostra o controle de altura.
  cardAspectRatio?: number;
  onCardAspectChange?: (ratio: number) => void;
  // Recorte exato do card na página + config de fundo — o fundo da área vira uma
  // "janela" para a página (célula do card na caixa, contexto ao redor). Quando
  // ausentes, usa `pageBackground` cru.
  pageCrop?: CropRect | null;
  pageBgConfig?: PageBgConfig;
  // Fallback: fundo da ÁREA do preview cru (null = cinza padrão).
  pageBackground?: React.CSSProperties | null;
  // Fundo da Etiqueta (config do catálogo) — controles movidos da aba Layout.
  // Quando `onCardBgChange` é passado, mostra "Fundo transparente" + "Cor" e a
  // caixa do card reflete a cor (ou fica transparente = janela para a página).
  hideCardBackground?: boolean;
  cardColor?: string;
  onCardBgChange?: (changes: {
    hideCardBackground?: boolean;
    cardColor?: string;
  }) => void;
}

// Editor livre do card: arraste variáveis e formas, montando o card. Opera sobre
// uma lista de elementos (`elements`/`onElementsChange`) — reutilizado no card do
// catálogo e na edição de um estilo salvo.
export function CardFreeEditor({
  elements,
  onElementsChange,
  product,
  onClose,
  initialSelectedId,
  onEditPhoto,
  onSetPrice,
  canManageSystem,
  onSaveStyle,
  hideSave,
  cardAspectRatio,
  onCardAspectChange,
  pageCrop,
  pageBgConfig,
  pageBackground,
}: CardFreeEditorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"USER" | "SYSTEM">("USER");
  const textInputRef = useRef<HTMLInputElement>(null);
  // Edição de texto INLINE no card (duplo-clique num elemento de texto): abre um
  // campo sobre o próprio elemento para digitar direto.
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  // Edição de PREÇO inline (duplo-clique numa variável de preço).
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");

  // Seleção inicial (duplo-clique numa variável na página): seleciona e, se for
  // texto, já entra na edição inline. Só ao mudar o pedido.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reage só ao initialSelectedId; `elements` é lido no momento, não deve re-disparar.
  useEffect(() => {
    if (!initialSelectedId) return;
    setSelectedIds([initialSelectedId]);
    const el = elements.find((e) => e.id === initialSelectedId);
    if (el?.kind === "text") setEditingTextId(initialSelectedId);
  }, [initialSelectedId]);

  // Tecla Delete/Backspace remove os elementos selecionados (ignora se estiver
  // digitando num campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        const kill = new Set(selectedIds);
        onElementsChange(elements.filter((el) => !kill.has(el.id)));
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [elements, selectedIds, onElementsChange]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Altura do canvas medida — para desenhar o contorno de seleção com o mesmo
  // raio uniforme (px) que o card usa.
  const [canvasH, setCanvasH] = useState(0);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    setCanvasH(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(([entry]) =>
      setCanvasH(entry.contentRect.height),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Área disponível para o card — o card vira o MAIOR quadrado (1:1) que cabe,
  // preenchendo a altura de borda a borda.
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Proporção largura/altura do card. Default = a proporção REAL da célula na
  // página (`pageCrop.aspect`) quando não há override manual — assim o card
  // nasce com o mesmo formato do seu lugar no encarte. O card vira o MAIOR
  // retângulo com essa proporção que cabe na área, com uma MARGEM ao redor.
  const aspect =
    cardAspectRatio && cardAspectRatio > 0
      ? cardAspectRatio
      : pageCrop?.aspect && pageCrop.aspect > 0
        ? pageCrop.aspect
        : 1;
  const AREA_PAD = 48;
  const availW = Math.max(0, area.w - AREA_PAD * 2);
  const availH = Math.max(0, area.h - AREA_PAD * 2);
  // Encaixe máximo mantendo a proporção, reduzido por PREVIEW_SCALE e com um
  // TETO em px (MAX_CARD_W): em telas largas o card não fica gigante. Largura e
  // altura caem juntas (proporção `aspect` e posições fracionárias preservadas).
  const PREVIEW_SCALE = 0.7;
  const MAX_CARD_W = 420;
  const cardW = Math.min(
    Math.max(0, Math.min(availW, availH * aspect)) * PREVIEW_SCALE,
    MAX_CARD_W,
  );
  const cardH = aspect > 0 ? cardW / aspect : cardW;
  // Fundo da área = "janela" para a página: a célula do card ocupa exatamente a
  // caixa (cardW×cardH centrada) e o contexto da página aparece ao redor.
  const areaBackground =
    pageBgConfig && area.w > 0 && cardW > 0
      ? pageWindowBg(pageBgConfig, pageCrop, {
          containerW: area.w,
          containerH: area.h,
          cardLeft: (area.w - cardW) / 2,
          cardTop: (area.h - cardH) / 2,
          cardW,
          cardH,
        })
      : pageBackground;

  const selSet = new Set(selectedIds);
  const single =
    selectedIds.length === 1
      ? (elements.find((e) => e.id === selectedIds[0]) ?? null)
      : null;

  const setElements = onElementsChange;

  const update = (id: string, patch: Partial<CardLayoutElement>) =>
    setElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const add = (el: CardLayoutElement) => {
    setElements([...elements, el]);
    setSelectedIds([el.id]);
  };

  const addVariable = (variable: CardVariable) => {
    const preset: Partial<CardLayoutElement> =
      variable === "photo"
        ? { w: 0.55, h: 0.4, z: 0, fontFrac: 0.08 }
        : variable === "priceReais"
          ? { w: 0.32, h: 0.34, z: 1, fontFrac: 0.32, fontWeight: 800 }
          : variable === "priceCents"
            ? { w: 0.22, h: 0.13, z: 1, fontFrac: 0.13, fontWeight: 800 }
            : variable === "priceCurrency"
              ? { w: 0.14, h: 0.1, z: 1, fontFrac: 0.1, fontWeight: 700 }
              : variable === "priceActive"
                ? { w: 0.5, h: 0.16, z: 1, fontFrac: 0.16, fontWeight: 800 }
                : { w: 0.5, h: 0.14, z: 1, fontFrac: 0.08, fontWeight: 600 };
    add(
      makeCardElement({ kind: "var", variable, x: 0.08, y: 0.08, ...preset }),
    );
  };

  // Preço destaque: reais grande + ",centavos" sobrescrito + "UND" embaixo.
  const addPricePreset = () => {
    const reais = makeCardElement({
      kind: "var",
      variable: "priceReais",
      x: 0.06,
      y: 0.34,
      w: 0.44,
      h: 0.42,
      fontFrac: 0.4,
      fontWeight: 800,
      align: "right",
      z: 2,
    });
    const cents = makeCardElement({
      kind: "var",
      variable: "priceCents",
      x: 0.52,
      y: 0.33,
      w: 0.28,
      h: 0.18,
      fontFrac: 0.17,
      fontWeight: 800,
      align: "left",
      z: 2,
    });
    const und = makeCardElement({
      kind: "text",
      text: "UND",
      x: 0.52,
      y: 0.52,
      w: 0.28,
      h: 0.12,
      fontFrac: 0.1,
      fontWeight: 700,
      align: "left",
      z: 2,
    });
    setElements([...elements, reais, cents, und]);
    setSelectedIds([reais.id, cents.id, und.id]);
  };

  const addShape = (shape: "rect" | "circle") =>
    add(
      makeCardElement({
        kind: "shape",
        shape,
        w: 0.4,
        h: shape === "circle" ? 0.28 : 0.2,
        x: 0.1,
        y: 0.1,
        z: -1,
        radius: shape === "rect" ? 0.06 : 0,
      }),
    );

  const addText = () =>
    add(
      makeCardElement({
        kind: "text",
        text: "TEXTO",
        x: 0.1,
        y: 0.1,
        w: 0.3,
        h: 0.12,
        z: 1,
        fontFrac: 0.09,
        fontWeight: 700,
      }),
    );

  const removeSelected = () => {
    setElements(elements.filter((e) => !selSet.has(e.id)));
    setSelectedIds([]);
  };

  const selectAll = () => setSelectedIds(elements.map((e) => e.id));

  // ── Arrastar / redimensionar (fração do canvas medido) ──
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.sx) / rect.width;
    const dy = (e.clientY - d.sy) / rect.height;
    if (d.mode === "move") {
      const moves = new Map(d.items.map((it) => [it.id, it]));
      setElements(
        elements.map((el) => {
          const it = moves.get(el.id);
          return it
            ? {
                ...el,
                x: clamp(it.ox + dx, -0.2, 0.98),
                y: clamp(it.oy + dy, -0.2, 0.98),
              }
            : el;
        }),
      );
    } else {
      update(d.id, {
        w: clamp(d.ow + dx, 0.05, 1),
        h: clamp(d.oh + dy, 0.03, 1),
      });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const beginDrag = (d: Drag) => {
    drag.current = d;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startMove = (e: React.PointerEvent, el: CardLayoutElement) => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Alterna o elemento na seleção (multi-seleção) sem arrastar.
      setSelectedIds((ids) =>
        ids.includes(el.id) ? ids.filter((i) => i !== el.id) : [...ids, el.id],
      );
      return;
    }
    // Se o alvo já está numa seleção múltipla, move o grupo; senão seleciona só ele.
    const ids =
      selSet.has(el.id) && selectedIds.length > 1 ? selectedIds : [el.id];
    setSelectedIds(ids);
    const items = elements
      .filter((x) => ids.includes(x.id))
      .map((x) => ({ id: x.id, ox: x.x, oy: x.y }));
    beginDrag({ mode: "move", sx: e.clientX, sy: e.clientY, items });
  };

  const startResize = (e: React.PointerEvent, el: CardLayoutElement) => {
    e.stopPropagation();
    setSelectedIds([el.id]);
    beginDrag({
      mode: "resize",
      id: el.id,
      sx: e.clientX,
      sy: e.clientY,
      ow: el.w,
      oh: el.h,
    });
  };

  const isText =
    single?.kind === "text" ||
    (single?.kind === "var" && single.variable !== "photo");

  // Arraste dos nós → ajusta a proporção (largura/altura) do card. Guarda as
  // dimensões e a direção (qual borda o nó move) no início do arraste.
  const resizeDrag = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    dx: number;
    dy: number;
  } | null>(null);
  const onCardResizeMove = (e: PointerEvent) => {
    const d = resizeDrag.current;
    if (!d || !onCardAspectChange) return;
    const newW = Math.max(60, d.w + (e.clientX - d.x) * d.dx);
    const newH = Math.max(60, d.h + (e.clientY - d.y) * d.dy);
    onCardAspectChange(Math.min(1.7, Math.max(0.5, newW / newH)));
  };
  const onCardResizeUp = () => {
    resizeDrag.current = null;
    window.removeEventListener("pointermove", onCardResizeMove);
    window.removeEventListener("pointerup", onCardResizeUp);
  };
  const startCardResize = (
    e: React.PointerEvent,
    dir: { x: number; y: number },
  ) => {
    e.preventDefault();
    e.stopPropagation();
    resizeDrag.current = {
      x: e.clientX,
      y: e.clientY,
      w: cardW,
      h: cardH,
      dx: dir.x,
      dy: dir.y,
    };
    window.addEventListener("pointermove", onCardResizeMove);
    window.addEventListener("pointerup", onCardResizeUp);
  };

  // Raio do contorno de seleção — casa com o raio uniforme (px) do card.
  const outlineRadius = (el: CardLayoutElement) => {
    if (el.kind === "shape")
      return el.shape === "circle"
        ? "9999px"
        : `${(el.radius ?? 0) * canvasH}px`;
    if (el.kind === "text" && el.boxed)
      return `${(el.radius ?? 0) * canvasH}px`;
    return "6px";
  };

  return (
    <div className="flex h-full flex-col gap-3 md:flex-row">
      {/* Card 1:1 — maior quadrado que cabe, preenchendo a altura */}
      <div
        ref={areaRef}
        className={`relative flex min-h-[40vh] min-w-0 flex-1 items-center justify-center overflow-hidden ${areaBackground ? "" : "bg-muted/30"}`}
        style={areaBackground ?? undefined}
      >
        {onClose && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute left-2 top-2 z-10 h-8 gap-1 text-xs shadow"
            onClick={onClose}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Button>
        )}
        <div
          className="relative"
          style={{
            width: cardW || undefined,
            height: cardH || undefined,
          }}
        >
          {/* Caixa do redimensionador: a Etiqueta é sempre transparente (fundo
              descontinuado) — o recorte da página aparece atrás. */}
          <div className="absolute inset-0 overflow-hidden rounded-lg border border-border/50">
            <div
              ref={canvasRef}
              className="absolute inset-0"
              onPointerDown={() => setSelectedIds([])}
            >
              <div className="pointer-events-none absolute inset-0">
                <CardFreeLayout
                  product={product}
                  elements={elements}
                  aspectRatio={String(aspect)}
                />
              </div>
              {elements.map((el) => {
                const isSel = selSet.has(el.id);
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: moldura de arraste/seleção do elemento no canvas
                  <div
                    key={el.id}
                    className="absolute"
                    style={{
                      left: `${el.x * 100}%`,
                      top: `${el.y * 100}%`,
                      width: `${el.w * 100}%`,
                      height: `${el.h * 100}%`,
                      // A moldura de interação segue o `z` da camada (mesma
                      // ordem do render visual). Sem isso, um retângulo mandado
                      // pra "Trás" continuava por cima e capturava os cliques.
                      // O selecionado sobe pro topo pra acessar alças/excluir.
                      zIndex: (el.z ?? 0) + (isSel ? 1000 : 0),
                      borderRadius: outlineRadius(el),
                      outline: isSel
                        ? "2px solid var(--color-primary, #2563eb)"
                        : "1px dashed color-mix(in srgb, var(--color-primary,#2563eb) 40%, transparent)",
                      cursor: "move",
                    }}
                    onPointerDown={(e) => startMove(e, el)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      // Foto → "Editar produto"; texto → edição de texto inline;
                      // preço → edição de valor inline (grava no catálogo).
                      if (el.kind === "var" && el.variable === "photo") {
                        onEditPhoto?.();
                        return;
                      }
                      if (el.kind === "text") {
                        setSelectedIds([el.id]);
                        setEditingTextId(el.id);
                        return;
                      }
                      if (el.kind === "var" && onSetPrice) {
                        const which = priceKindOf(el.variable);
                        if (!which) return;
                        const cur =
                          which === "offer"
                            ? (product.promotionalPrice ?? product.salePrice)
                            : product.salePrice;
                        setSelectedIds([el.id]);
                        setEditingPriceValue(cur != null ? String(cur) : "");
                        setEditingPriceId(el.id);
                      }
                    }}
                  >
                    {el.kind === "text" && editingTextId === el.id && (
                      <textarea
                        // biome-ignore lint/a11y/noAutofocus: entra em edição no duplo-clique
                        autoFocus
                        value={el.text ?? ""}
                        onChange={(ev) =>
                          update(el.id, { text: ev.target.value })
                        }
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onBlur={() => setEditingTextId(null)}
                        onKeyDown={(ev) => {
                          ev.stopPropagation();
                          if (
                            (ev.key === "Enter" && !ev.shiftKey) ||
                            ev.key === "Escape"
                          ) {
                            ev.preventDefault();
                            (ev.target as HTMLTextAreaElement).blur();
                          }
                        }}
                        style={{ fontFamily: el.fontFamily }}
                        className="absolute inset-0 z-20 resize-none rounded-sm border border-primary bg-background/95 p-0.5 text-center text-[11px] leading-tight text-foreground outline-none"
                      />
                    )}
                    {el.kind === "var" && editingPriceId === el.id && (
                      <input
                        // biome-ignore lint/a11y/noAutofocus: entra em edição no duplo-clique
                        autoFocus
                        type="number"
                        min={0}
                        step={0.01}
                        value={editingPriceValue}
                        onChange={(ev) => setEditingPriceValue(ev.target.value)}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onBlur={() => {
                          const which = priceKindOf(el.variable);
                          if (which) {
                            const num =
                              editingPriceValue !== ""
                                ? Number(editingPriceValue)
                                : Number.NaN;
                            onSetPrice?.(
                              which,
                              Number.isFinite(num) && num > 0 ? num : null,
                            );
                          }
                          setEditingPriceId(null);
                        }}
                        onKeyDown={(ev) => {
                          ev.stopPropagation();
                          if (ev.key === "Enter" || ev.key === "Escape") {
                            ev.preventDefault();
                            (ev.target as HTMLInputElement).blur();
                          }
                        }}
                        className="absolute inset-0 z-20 w-full rounded-sm border border-primary bg-background/95 p-0.5 text-center text-[11px] font-semibold leading-tight text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    )}
                    {isSel && selectedIds.length === 1 && (
                      <>
                        <button
                          type="button"
                          className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-destructive shadow"
                          title="Excluir"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setElements(elements.filter((x) => x.id !== el.id));
                            setSelectedIds([]);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm border-2 border-primary bg-background"
                          style={{ cursor: "nwse-resize" }}
                          title="Redimensionar"
                          onPointerDown={(e) => startResize(e, el)}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {onCardAspectChange &&
            RESIZE_HANDLES.map((h) => (
              <button
                type="button"
                key={h.key}
                aria-label="Alça de dimensionamento da Etiqueta"
                title="Arraste para redimensionar a Etiqueta (duplo-clique = 1:1)"
                onPointerDown={(e) => startCardResize(e, h.dir)}
                onDoubleClick={() => onCardAspectChange(1)}
                className="absolute z-30 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-md ring-1 ring-black/20"
                style={{ ...h.pos, cursor: h.cursor, touchAction: "none" }}
              />
            ))}
        </div>
      </div>

      {/* Paleta + propriedades */}
      <div className="flex w-full flex-col gap-2 p-2.5 md:h-full md:w-[416px] md:overflow-y-auto">
        <h3 className="text-sm font-semibold">Montar Etiqueta</h3>

        {/* Inserir: variáveis + formas + texto — ícone + nome embaixo. O painel
            largo (30% maior) mantém 3 linhas, então cabe sem rolagem. */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Inserir</Label>
          <div className="grid grid-cols-5 gap-1">
            {CARD_VARIABLES.map((v) => {
              const Icon = VAR_ICONS[v.value];
              return (
                <Button
                  key={v.value}
                  type="button"
                  variant="outline"
                  className="h-auto flex-col gap-1 px-1 py-1.5 text-[10px] leading-tight"
                  title={v.label}
                  onClick={() => addVariable(v.value)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="w-full truncate text-center">{v.label}</span>
                </Button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col gap-1 px-1 py-1.5 text-[10px] leading-tight"
              onClick={() => addShape("rect")}
            >
              <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-full truncate text-center">Retângulo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col gap-1 px-1 py-1.5 text-[10px] leading-tight"
              onClick={() => addShape("circle")}
            >
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-full truncate text-center">Círculo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col gap-1 px-1 py-1.5 text-[10px] leading-tight"
              onClick={addText}
            >
              <Type className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-full truncate text-center">Texto</span>
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-0.5 w-full gap-1 text-xs"
            onClick={addPricePreset}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Preço destaque (5,49 UND)
          </Button>
        </div>

        {/* Seleção */}
        {elements.length > 0 && (
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 gap-1 text-xs"
              onClick={selectAll}
            >
              <BoxSelect className="h-3.5 w-3.5" />
              Selecionar tudo
            </Button>
            {selectedIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 text-xs text-destructive"
                onClick={removeSelected}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedIds.length > 1
                  ? `Excluir (${selectedIds.length})`
                  : "Excluir"}
              </Button>
            )}
          </div>
        )}

        {/* Propriedades (1 selecionado) */}
        {single ? (
          <div className="flex flex-col gap-2 rounded-2xl border bg-card/40 p-3">
            <p className="text-[13px] font-medium text-foreground">
              {single.kind === "shape"
                ? "Forma"
                : single.kind === "text"
                  ? "Texto fixo"
                  : (CARD_VARIABLES.find((v) => v.value === single.variable)
                      ?.label ?? "Elemento")}
            </p>

            {single.kind === "text" && (
              <Input
                ref={textInputRef}
                value={single.text ?? ""}
                onChange={(e) => update(single.id, { text: e.target.value })}
                placeholder="Texto (ex.: UND, cada)"
                className="h-8"
              />
            )}

            {isText && (
              <>
                {/* Tipografia — cada opção renderizada na própria fonte. */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    Tipografia
                  </span>
                  <Select
                    value={single.fontFamily ?? "Inter, sans-serif"}
                    onValueChange={(v) => update(single.id, { fontFamily: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_FONTS.map((f) => (
                        <SelectItem
                          key={f.value}
                          value={f.value}
                          style={{ fontFamily: f.value }}
                        >
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Tamanho
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        update(single.id, {
                          fontFrac: clamp(
                            (single.fontFrac ?? 0.08) - 0.01,
                            0.02,
                            0.5,
                          ),
                        })
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-[11px] tabular-nums">
                      {Math.round((single.fontFrac ?? 0.08) * 100)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        update(single.id, {
                          fontFrac: clamp(
                            (single.fontFrac ?? 0.08) + 0.01,
                            0.02,
                            0.5,
                          ),
                        })
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    Cor
                    <input
                      type="color"
                      value={single.color ?? "#111111"}
                      onChange={(e) =>
                        update(single.id, { color: e.target.value })
                      }
                      className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
                    />
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant={
                      (single.fontWeight ?? 600) >= 700 ? "default" : "outline"
                    }
                    className="h-7 w-7"
                    onClick={() =>
                      update(single.id, {
                        fontWeight:
                          (single.fontWeight ?? 600) >= 700 ? 500 : 800,
                      })
                    }
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex gap-1">
                    {(
                      [
                        { v: "left", Icon: AlignLeft },
                        { v: "center", Icon: AlignCenter },
                        { v: "right", Icon: AlignRight },
                      ] as const
                    ).map(({ v, Icon }) => (
                      <Button
                        key={v}
                        type="button"
                        size="icon"
                        variant={
                          (single.align ?? "left") === v ? "default" : "outline"
                        }
                        className="h-7 w-7"
                        onClick={() => update(single.id, { align: v })}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Caixa (borda/fundo) — para a forma Retângulo/Círculo (igual ao
                box de texto: fundo + borda + contorno + cantos). */}
            {single.kind === "shape" && (
              <div className="flex flex-col gap-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Caixa (borda/fundo)
                  </span>
                  {/* Alterna entre preenchido e SEM fundo (transparente — só
                      contorno, deixando o fundo da página aparecer). */}
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      single.fill === "transparent" ? "default" : "outline"
                    }
                    className="h-6 text-[11px]"
                    onClick={() =>
                      update(single.id, {
                        fill:
                          single.fill === "transparent"
                            ? "#dc2626"
                            : "transparent",
                      })
                    }
                  >
                    Sem fundo
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    Fundo
                    <input
                      type="color"
                      value={
                        single.fill && single.fill !== "transparent"
                          ? single.fill
                          : "#dc2626"
                      }
                      disabled={single.fill === "transparent"}
                      onChange={(e) =>
                        update(single.id, { fill: e.target.value })
                      }
                      className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    Borda
                    <input
                      type="color"
                      value={single.outlineColor ?? "#111111"}
                      onChange={(e) =>
                        update(single.id, { outlineColor: e.target.value })
                      }
                      className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Contorno
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={Math.round((single.outlineWidth ?? 0) * 1000)}
                    onChange={(e) =>
                      update(single.id, {
                        outlineWidth: Number(e.target.value) / 1000,
                      })
                    }
                    className="flex-1"
                  />
                </label>
                {single.shape === "rect" && (
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    Cantos
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={Math.round((single.radius ?? 0) * 100)}
                      onChange={(e) =>
                        update(single.id, {
                          radius: Number(e.target.value) / 100,
                        })
                      }
                      className="flex-1"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Caixa (borda/contorno) — para textos e variáveis de texto */}
            {isText && (
              <div className="flex flex-col gap-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Caixa (borda/fundo)
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={single.boxed ? "default" : "outline"}
                    className="h-6 text-[11px]"
                    onClick={() =>
                      update(single.id, {
                        boxed: !single.boxed,
                        ...(single.boxed
                          ? {}
                          : {
                              fill: "#ffffff",
                              outlineWidth: single.outlineWidth ?? 0.006,
                              outlineColor: single.outlineColor ?? "#111111",
                              radius: single.radius ?? 0.04,
                            }),
                      })
                    }
                  >
                    {single.boxed ? "Ligada" : "Desligada"}
                  </Button>
                </div>
                {single.boxed && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Fundo
                        <input
                          type="color"
                          value={single.fill ?? "#ffffff"}
                          onChange={(e) =>
                            update(single.id, { fill: e.target.value })
                          }
                          className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Borda
                        <input
                          type="color"
                          value={single.outlineColor ?? "#111111"}
                          onChange={(e) =>
                            update(single.id, { outlineColor: e.target.value })
                          }
                          className="h-8 w-8 cursor-pointer rounded-xl border p-0 shadow-sm"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      Contorno
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={Math.round((single.outlineWidth ?? 0) * 1000)}
                        onChange={(e) =>
                          update(single.id, {
                            outlineWidth: Number(e.target.value) / 1000,
                          })
                        }
                        className="flex-1"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      Cantos
                      <input
                        type="range"
                        min={0}
                        max={20}
                        value={Math.round((single.radius ?? 0) * 100)}
                        onChange={(e) =>
                          update(single.id, {
                            radius: Number(e.target.value) / 100,
                          })
                        }
                        className="flex-1"
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Camada</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px]"
                  onClick={() => update(single.id, { z: (single.z ?? 0) - 1 })}
                >
                  Trás
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px]"
                  onClick={() => update(single.id, { z: (single.z ?? 0) + 1 })}
                >
                  Frente
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            {selectedIds.length > 1
              ? `${selectedIds.length} elementos selecionados — arraste para mover juntos.`
              : "Toque numa variável ou forma para adicionar. Shift+clique para selecionar vários."}
          </p>
        )}

        {/* Salvar na biblioteca "Estilos" (modo criação) — compacto: nome +
            botão na mesma linha, pra não ocupar altura à toa. */}
        {!hideSave && (
          <div className="mt-auto flex flex-col gap-1.5 rounded-xl border bg-card/40 p-2">
            {canManageSystem && (
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "USER" ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setScope("USER")}
                >
                  Meu estilo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scope === "SYSTEM" ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => setScope("SYSTEM")}
                >
                  Do sistema
                </Button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Salvar como estilo…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 flex-1"
              />
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Salvar em Estilos"
                disabled={!name.trim() || elements.length === 0}
                onClick={() => onSaveStyle?.(name.trim(), scope)}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
