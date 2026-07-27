import type { ItemNode, ModuleNode, ShelfNode } from "./types";

// Empacotamento horizontal da prateleira. Puro de propósito: sem React, sem
// Konva, sem Prisma — o mesmo cálculo alimenta o canvas, o painel de validação
// e o PDF, e pode ser testado por script.

/** Largura consumida pelo item: frentes × largura da unidade (ou da caixa). */
export function itemWidthMm(item: ItemNode): number {
  const unitWidth = item.widthMm;
  return Math.max(0, item.facings) * Math.max(0, unitWidth);
}

/** Altura ocupada: empilhamento vertical de frentes. */
export function itemHeightMm(item: ItemNode): number {
  return Math.max(1, item.facingsHigh) * Math.max(0, item.heightMm);
}

/** Profundidade ocupada: quantas unidades atrás da frente. */
export function itemDepthMm(item: ItemNode): number {
  return Math.max(1, item.facingsDeep) * Math.max(0, item.depthMm);
}

export interface Placement {
  itemId: string;
  xMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PackedShelf {
  placements: Placement[];
  usedMm: number;
  freeMm: number;
  /** Quanto passou da largura útil. 0 quando cabe. */
  overflowMm: number;
  /** Itens que começam ou terminam fora da prateleira. */
  overflowItemIds: string[];
  /** Itens mais altos que o vão livre até a prateleira de cima. */
  tooTallItemIds: string[];
  /** Itens mais fundos que a prateleira. */
  tooDeepItemIds: string[];
}

export interface PackShelfOptions {
  /** Vão livre até a prateleira de cima; sem isso não dá para checar altura. */
  clearanceMm?: number;
}

/**
 * Posiciona os itens da prateleira.
 *
 * PACKED: encostados, na ordem de `position` — a posição é DERIVADA, nunca
 * persistida, porque mudar as frentes de um item desloca todos à direita e
 * gravar x de cada um custaria dezenas de escritas por clique.
 *
 * FREE: respeita `xMm` de cada item.
 *
 * Nunca lança nem "conserta" o excesso: devolve o transbordo para a UI
 * sinalizar. Bloquear a edição no meio do raciocínio do usuário é pior do que
 * deixá-lo ver que não coube.
 */
export function packShelf(
  shelf: ShelfNode,
  items: ItemNode[],
  options: PackShelfOptions = {},
): PackedShelf {
  const ordered =
    shelf.layoutMode === "FREE"
      ? [...items].sort((a, b) => (a.xMm ?? 0) - (b.xMm ?? 0))
      : [...items].sort((a, b) => a.position - b.position);

  const placements: Placement[] = [];
  const overflowItemIds: string[] = [];
  const tooTallItemIds: string[] = [];
  const tooDeepItemIds: string[] = [];

  let cursorMm = 0;
  for (const item of ordered) {
    const width = itemWidthMm(item);
    const height = itemHeightMm(item);
    const xMm = shelf.layoutMode === "FREE" ? (item.xMm ?? 0) : cursorMm;

    placements.push({ itemId: item.id, xMm, widthMm: width, heightMm: height });

    if (xMm < 0 || xMm + width > shelf.widthMm) {
      overflowItemIds.push(item.id);
    }
    if (options.clearanceMm != null && height > options.clearanceMm) {
      tooTallItemIds.push(item.id);
    }
    if (itemDepthMm(item) > shelf.depthMm) {
      tooDeepItemIds.push(item.id);
    }

    cursorMm = shelf.layoutMode === "FREE" ? cursorMm : cursorMm + width;
  }

  // Em FREE o "usado" é a borda mais à direita, não a soma — itens podem ter
  // buracos entre si, e somar larguras daria um número que não existe na tela.
  const usedMm =
    shelf.layoutMode === "FREE"
      ? placements.reduce((max, p) => Math.max(max, p.xMm + p.widthMm), 0)
      : cursorMm;

  return {
    placements,
    usedMm,
    freeMm: Math.max(0, shelf.widthMm - usedMm),
    overflowMm: Math.max(0, usedMm - shelf.widthMm),
    overflowItemIds,
    tooTallItemIds,
    tooDeepItemIds,
  };
}

/** Vão livre de uma prateleira até a de cima (ou até o topo da gôndola). */
export function shelfClearanceMm(
  shelf: ShelfNode,
  shelvesInModule: ShelfNode[],
  fixtureHeightMm: number,
): number {
  const above = shelvesInModule
    .filter((candidate) => candidate.yMm > shelf.yMm)
    .sort((a, b) => a.yMm - b.yMm)[0];
  const ceilingMm = above ? above.yMm - above.thicknessMm : fixtureHeightMm;
  return Math.max(0, ceilingMm - shelf.yMm);
}

export function shelfOccupancyPct(shelf: ShelfNode, items: ItemNode[]): number {
  if (shelf.widthMm <= 0) return 0;
  const { usedMm } = packShelf(shelf, items);
  return Math.round((usedMm / shelf.widthMm) * 100);
}

/** Metro linear total do módulo — base do "% de gôndola" das negociações. */
export function moduleLinearMm(
  moduleNode: ModuleNode,
  shelves: ShelfNode[],
): number {
  return shelves
    .filter((shelf) => shelf.moduleId === moduleNode.id)
    .reduce((total, shelf) => total + shelf.widthMm, 0);
}

/** Linear ocupado por um subconjunto de itens — numerador do share. */
export function linearMmOfItems(items: ItemNode[]): number {
  return items.reduce((total, item) => total + itemWidthMm(item), 0);
}

/**
 * Índice de inserção ao soltar um produto numa posição x da prateleira.
 * Usa o ponto MÉDIO de cada item: soltar na metade direita de um produto
 * insere depois dele, o que é o que a mão espera.
 */
export function insertIndexAt(
  shelf: ShelfNode,
  items: ItemNode[],
  dropXMm: number,
): number {
  const { placements } = packShelf(shelf, items);
  let index = 0;
  for (const placement of placements) {
    if (dropXMm > placement.xMm + placement.widthMm / 2) index++;
    else break;
  }
  return index;
}

/** Reordena mantendo `position` contígua a partir de 0. */
export function reorderPositions(
  items: ItemNode[],
  movedItemId: string,
  toIndex: number,
): { id: string; position: number }[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const fromIndex = ordered.findIndex((item) => item.id === movedItemId);
  if (fromIndex === -1) return [];

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved);

  return ordered
    .map((item, index) => ({ id: item.id, position: index }))
    .filter((entry) => {
      const original = items.find((item) => item.id === entry.id);
      return original && original.position !== entry.position;
    });
}
