"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  MoreVertical,
  SendToBack,
  Square,
  Tag,
  Trash2,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import type {
  CatalogConfig,
  LayerSelection,
  Overlay,
  StyleBlock,
  TextElement,
} from "../types";
import { renderOverlayShape } from "./catalog-preview";
import { PAGE_H_VALUES, PAGE_W } from "../lib/layout";
import {
  alignBoxes,
  distributeBoxes,
  type AlignMode,
  type Box,
} from "../lib/arrange";

// Painel de CAMADAS da página.
//
// A ordem de empilhamento vem da posição no array de cada família, e as famílias
// têm ordem FIXA no render (`catalog-preview.tsx`): produtos no fundo, depois
// formas/etiquetas, textos e, por cima, os blocos de estilo. A exceção é a forma
// marcada como "atrás dos produtos", que usa z negativo — por isso ela aparece
// num grupo separado, abaixo de tudo.
//
// A lista é exibida na ordem VISUAL: o primeiro item está na frente. No array é
// o contrário, então a inversão acontece aqui.

type Family = "blocks" | "texts" | "overlays" | "behind";

type Row = {
  id: string;
  family: Family;
  // Índice REAL no array da família: a lista é invertida e, no caso das formas,
  // filtrada — o arraste precisa do índice de origem, não do visual.
  arrayIndex: number;
  label: string;
  preview: React.ReactNode;
};

interface LayersPanelProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  selection?: LayerSelection;
  onSelectionChange?: (sel: LayerSelection) => void;
}

const FAMILY_LABEL: Record<Family, string> = {
  blocks: "Blocos de estilo",
  texts: "Textos",
  overlays: "Formas e etiquetas",
  behind: "Atrás dos produtos",
};

/** Miniatura da camada — reconhecer pela cara é mais rápido que ler "Forma 3". */
function overlayPreview(o: Overlay) {
  if (o.shape)
    return (
      <div className="h-full w-full p-1">
        {renderOverlayShape(o.shape, o.fill ?? "#dc2626")}
      </div>
    );
  if (o.assetKey)
    return (
      // biome-ignore lint/performance/noImgElement: miniatura da camada
      <img
        src={constructUrl(o.assetKey)}
        alt=""
        className="h-full w-full object-contain"
      />
    );
  return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function LayersPanel({
  config,
  onConfigChange,
  selection,
  onSelectionChange,
}: LayersPanelProps) {
  const [dragging, setDragging] = useState<{
    family: Family;
    index: number;
  } | null>(null);

  const overlays = config.overlays ?? [];
  const texts = config.texts ?? [];
  const blocks = config.styleBlocks ?? [];

  const rowsOf = (family: Family): Row[] => {
    if (family === "overlays" || family === "behind")
      return overlays
        .map((o, i) => ({ o, i }))
        .filter(({ o }) =>
          family === "behind" ? !!o.behindProducts : !o.behindProducts,
        )
        .map(({ o, i }) => ({
          id: o.id,
          family,
          arrayIndex: i,
          label: o.shape ? `Forma ${i + 1}` : `Imagem ${i + 1}`,
          preview: overlayPreview(o),
        }));
    if (family === "texts")
      return texts.map((t: TextElement, i) => ({
        id: t.id,
        family,
        arrayIndex: i,
        label: t.text?.trim() || `Texto ${i + 1}`,
        preview: (
          <span
            className="block w-full truncate px-1 text-center text-[9px] font-semibold"
            style={{ color: t.color }}
          >
            {t.text?.trim() || "Texto"}
          </span>
        ),
      }));
    return blocks.map((b: StyleBlock, i) => ({
      id: b.id,
      family,
      arrayIndex: i,
      label: `Bloco ${i + 1}`,
      preview: <Tag className="h-3.5 w-3.5 text-muted-foreground" />,
    }));
  };

  const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const applyReorder = (family: Family, from: number, to: number) => {
    if (from === to) return;
    if (family === "overlays" || family === "behind")
      onConfigChange({ overlays: reorder(overlays, from, to) });
    else if (family === "texts")
      onConfigChange({ texts: reorder(texts, from, to) });
    else onConfigChange({ styleBlocks: reorder(blocks, from, to) });
  };

  // ── Ações da camada ──
  const move = (row: Row, dir: -1 | 1) => {
    const len =
      row.family === "texts"
        ? texts.length
        : row.family === "blocks"
          ? blocks.length
          : overlays.length;
    const to = row.arrayIndex + dir;
    if (to < 0 || to >= len) return;
    applyReorder(row.family, row.arrayIndex, to);
  };

  const remove = (row: Row) => {
    if (row.family === "texts")
      onConfigChange({ texts: texts.filter((t) => t.id !== row.id) });
    else if (row.family === "blocks")
      onConfigChange({ styleBlocks: blocks.filter((b) => b.id !== row.id) });
    else onConfigChange({ overlays: overlays.filter((o) => o.id !== row.id) });
    onSelectionChange?.(null);
  };

  const duplicate = (row: Row) => {
    const id = crypto.randomUUID();
    // Desloca a cópia para ela não nascer exatamente sobre a original.
    const off = 16;
    if (row.family === "texts") {
      const t = texts[row.arrayIndex];
      if (t)
        onConfigChange({
          texts: [...texts, { ...t, id, x: t.x + off, y: t.y + off }],
        });
      return;
    }
    if (row.family === "blocks") {
      const b = blocks[row.arrayIndex];
      if (b)
        onConfigChange({
          styleBlocks: [...blocks, { ...b, id, x: b.x + off, y: b.y + off }],
        });
      return;
    }
    const o = overlays[row.arrayIndex];
    if (o)
      onConfigChange({
        overlays: [...overlays, { ...o, id, x: o.x + off, y: o.y + off }],
      });
  };

  const toggleBehind = (row: Row) => {
    const o = overlays[row.arrayIndex];
    if (!o) return;
    onConfigChange({
      overlays: overlays.map((x) =>
        x.id === o.id ? { ...x, behindProducts: !x.behindProducts } : x,
      ),
    });
  };

  const kindOf = (family: Family) =>
    family === "texts"
      ? ("text" as const)
      : family === "blocks"
        ? ("styleBlock" as const)
        : ("element" as const);

  const selectRow = (row: Row) =>
    onSelectionChange?.({ kind: kindOf(row.family), id: row.id });

  const isSelected = (row: Row) => {
    if (!selection || !("id" in selection)) return false;
    return selection.kind === kindOf(row.family) && selection.id === row.id;
  };

  const families: Family[] = ["blocks", "texts", "overlays", "behind"];
  const vazio = overlays.length + texts.length + blocks.length === 0;

  // ── Organizar: alinhar / distribuir ──
  //
  // O alvo é o elemento SELECIONADO; sem seleção, a página inteira (todos os
  // elementos livres de uma vez). Alinhar com um só centraliza na página —
  // que é o uso mais comum e o que o Canva faz.
  const boxesDaPagina = (): {
    boxes: Box[];
    kind: Map<string, Family>;
  } => {
    const boxes: Box[] = [];
    const kind = new Map<string, Family>();
    const push = (
      arr: { id: string; x: number; y: number; w: number; h: number }[],
      family: Family,
    ) => {
      for (const e of arr) {
        boxes.push({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h });
        kind.set(e.id, family);
      }
    };
    push(overlays, "overlays");
    push(texts, "texts");
    push(blocks, "blocks");
    return { boxes, kind };
  };

  const aplicarPosicoes = (novas: Box[], kind: Map<string, Family>) => {
    const porId = new Map(novas.map((b) => [b.id, b]));
    const patch: Partial<CatalogConfig> = {};
    if (novas.some((b) => kind.get(b.id) === "overlays"))
      patch.overlays = overlays.map((o) => {
        const n = porId.get(o.id);
        return n ? { ...o, x: n.x, y: n.y } : o;
      });
    if (novas.some((b) => kind.get(b.id) === "texts"))
      patch.texts = texts.map((t) => {
        const n = porId.get(t.id);
        return n ? { ...t, x: n.x, y: n.y } : t;
      });
    if (novas.some((b) => kind.get(b.id) === "blocks"))
      patch.styleBlocks = blocks.map((b) => {
        const n = porId.get(b.id);
        return n ? { ...b, x: n.x, y: n.y } : b;
      });
    if (Object.keys(patch).length > 0) onConfigChange(patch);
  };

  const alvo = () => {
    const { boxes, kind } = boxesDaPagina();
    if (selection && "id" in selection) {
      const sel = boxes.filter((b) => b.id === selection.id);
      if (sel.length > 0) return { boxes: sel, kind };
    }
    return { boxes, kind };
  };

  const pageH = PAGE_H_VALUES[config.pageSize] ?? PAGE_W;
  const alinhar = (mode: AlignMode) => {
    const { boxes, kind } = alvo();
    if (boxes.length === 0) return;
    aplicarPosicoes(alignBoxes(boxes, mode, { w: PAGE_W, h: pageH }), kind);
  };
  const distribuir = (axis: "h" | "v") => {
    // Distribuir com um elemento só não faz sentido — usa todos da página.
    const { boxes, kind } = boxesDaPagina();
    if (boxes.length < 3) return;
    aplicarPosicoes(distributeBoxes(boxes, axis), kind);
  };

  const ALINHAR: { mode: AlignMode; label: string; Icon: typeof Square }[] = [
    { mode: "left", label: "Alinhar à esquerda", Icon: AlignStartVertical },
    {
      mode: "center-h",
      label: "Centralizar na horizontal",
      Icon: AlignCenterVertical,
    },
    { mode: "right", label: "Alinhar à direita", Icon: AlignEndVertical },
    { mode: "top", label: "Alinhar ao topo", Icon: AlignStartHorizontal },
    {
      mode: "center-v",
      label: "Centralizar na vertical",
      Icon: AlignCenterHorizontal,
    },
    { mode: "bottom", label: "Alinhar à base", Icon: AlignEndHorizontal },
  ];

  const umSelecionado = !!selection && "id" in selection;

  return (
    <Tabs defaultValue="camadas" className="flex flex-col gap-2">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="organizar" className="text-xs">
          Organizar
        </TabsTrigger>
        <TabsTrigger value="camadas" className="text-xs">
          Camadas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="organizar" className="mt-0 flex flex-col gap-3">
        <p className="text-[11px] leading-tight text-muted-foreground">
          {umSelecionado
            ? "Alinhando o elemento selecionado em relação à página."
            : "Sem seleção: alinha todos os elementos da página entre si."}
        </p>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Alinhar
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {ALINHAR.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                title={label}
                onClick={() => alinhar(mode)}
                className="flex aspect-square items-center justify-center rounded-md border bg-card/40 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Distribuir espaço
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              title="Distribuir na horizontal"
              onClick={() => distribuir("h")}
              className="flex h-9 flex-1 items-center justify-center rounded-md border bg-card/40 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
            >
              <AlignHorizontalSpaceAround className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Distribuir na vertical"
              onClick={() => distribuir("v")}
              className="flex h-9 flex-1 items-center justify-center rounded-md border bg-card/40 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
            >
              <AlignVerticalSpaceAround className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">
            Precisa de 3 ou mais elementos: os das pontas ficam parados e o vão
            entre os demais fica igual.
          </p>
        </div>
      </TabsContent>

      <TabsContent value="camadas" className="mt-0 flex flex-col gap-2">
        {vazio ? (
          <p className="rounded-md bg-muted/40 px-3 py-3 text-center text-[12px] text-muted-foreground">
            Nada nesta página ainda. Adicione uma forma, imagem ou texto.
          </p>
        ) : (
          <>
            <p className="text-[11px] leading-tight text-muted-foreground">
              De cima para baixo: o primeiro está na frente. Arraste para
              reordenar dentro de cada grupo.
            </p>
            {families.map((family) => {
              const rows = rowsOf(family).slice().reverse();
              if (rows.length === 0) return null;
              return (
                <div key={family} className="flex flex-col gap-1">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {FAMILY_LABEL[family]}
                  </p>
                  {rows.map((row) => (
                    // biome-ignore lint/a11y/noStaticElementInteractions: linha arrastável da lista de camadas
                    <div
                      key={row.id}
                      draggable
                      onDragStart={() =>
                        setDragging({ family, index: row.arrayIndex })
                      }
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => {
                        if (dragging?.family === family) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragging?.family !== family) return;
                        applyReorder(family, dragging.index, row.arrayIndex);
                        setDragging(null);
                      }}
                      onClick={() => selectRow(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") selectRow(row);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border p-1.5",
                        isSelected(row)
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/60",
                        dragging?.family === family &&
                          dragging.index === row.arrayIndex &&
                          "opacity-50",
                      )}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                      {/* Xadrez atrás: elemento claro sobre fundo claro sumiria. */}
                      <div className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:8px_8px]">
                        {row.preview}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {row.label}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            title="Ações da camada"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => move(row, 1)}>
                            <ArrowUp className="mr-2 h-3.5 w-3.5" />
                            Trazer para frente
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => move(row, -1)}>
                            <ArrowDown className="mr-2 h-3.5 w-3.5" />
                            Enviar para trás
                          </DropdownMenuItem>
                          {(family === "overlays" || family === "behind") && (
                            <DropdownMenuItem onClick={() => toggleBehind(row)}>
                              <SendToBack className="mr-2 h-3.5 w-3.5" />
                              {family === "behind"
                                ? "Trazer para frente dos produtos"
                                : "Enviar para trás dos produtos"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => duplicate(row)}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => remove(row)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
