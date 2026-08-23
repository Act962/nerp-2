import type { CatalogConfig, CatalogProduct } from "../types";
import { ensurePages } from "../types";

// Distribuição de páginas do Catálogo Promocional — versão PURA, para render fora
// do editor (ex.: página pública por link). Espelha a lógica de `catalog-editor.tsx`
// (configForPage / pageChunks / gridProducts / blockProductIds). MANTER EM SINCRONIA
// com o editor: se a distribuição mudar lá, atualizar aqui.

export const PAGE_W = 1080;
export const PAGE_H_VALUES: Record<CatalogConfig["pageSize"], number> = {
  square: 1080,
  story: 1920,
  portrait: 1440,
};
const HEADER_H = 80;
const BOTTOM_BUFFER = 32;
const GAP4 = 16;
const GAP3 = 12;

const TEXT_SIZE_PX: Record<CatalogConfig["textSize"], number> = {
  xs: 12,
  sm: 16,
  base: 22,
  lg: 30,
  xl: 40,
  "2xl": 52,
  "3xl": 64,
  "4xl": 80,
};

function estimateCardHeight(
  cardStyle: CatalogConfig["cardStyle"],
  cardWidth: number,
  config: CatalogConfig,
): number {
  const lineH = (TEXT_SIZE_PX[config.textSize] ?? 16) * 1.4;
  switch (cardStyle) {
    case "compact":
      return Math.max(90, 80 + lineH);
    case "list": {
      let h = Math.max(116, 80 + 24 + lineH);
      if (config.showCategory) h += lineH;
      if (config.showStock) h += lineH;
      return h;
    }
    case "minimal":
      return cardWidth + 16 + lineH * 2 + 8;
    default: {
      let contentH = 24 + lineH * 2 + lineH;
      if (config.showCategory) contentH += lineH;
      if (config.showSku) contentH += lineH;
      if (config.showDescription) contentH += lineH * 2;
      if (config.showStock) contentH += lineH;
      contentH += lineH * 2;
      return cardWidth + contentH;
    }
  }
}

function getItemsPerPage(
  layout: CatalogConfig["layout"],
  pageSize: CatalogConfig["pageSize"],
  config: CatalogConfig,
): number {
  const pageH = PAGE_H_VALUES[pageSize];
  const availH = Math.max(
    0,
    pageH - config.paddingTop - config.paddingBottom - HEADER_H - BOTTOM_BUFFER,
  );
  const availW = Math.max(1, PAGE_W - config.paddingLeft - config.paddingRight);
  const gridItems = (cols: number, gap: number) => {
    const cardW = (availW - (cols - 1) * gap) / cols;
    const cardH = estimateCardHeight(config.cardStyle, cardW, config);
    const rows = Math.floor(availH / (cardH + gap));
    return Math.max(cols, rows * cols);
  };
  switch (layout) {
    case "custom":
      return Math.max(1, (config.gridCols ?? 3) * (config.gridRows ?? 4));
    case "grid-2":
      return gridItems(2, GAP4);
    case "grid-3":
      return gridItems(3, GAP4);
    case "grid-4":
      return gridItems(4, GAP3);
    case "masonry":
      return gridItems(3, GAP4);
    case "list": {
      const cardH = estimateCardHeight(config.cardStyle, availW, config);
      return Math.max(1, Math.floor(availH / (cardH + GAP3)));
    }
    case "table": {
      const cardH = estimateCardHeight(config.cardStyle, availW, config);
      return Math.max(1, Math.floor(availH / Math.max(1, cardH)));
    }
    case "carousel": {
      const cardW = Math.min(availW / 2, 280);
      return Math.max(4, Math.floor(availW / (cardW + GAP4)));
    }
    case "featured": {
      const featH = estimateCardHeight("standard", availW, config);
      const remainH = availH - featH - GAP4;
      if (remainH <= 0) return 1;
      const secCardW = (availW - 2 * GAP4) / 3;
      const secCardH = estimateCardHeight(config.cardStyle, secCardW, config);
      const secRows = Math.floor(remainH / (secCardH + GAP4));
      return Math.max(1, 1 + secRows * 3);
    }
    default:
      return 6;
  }
}

// Transformação cliente dos produtos (espelha `catalog-editor.tsx`): remove os
// excluídos, aplica `priceOverrides`, ordena por `sortBy` e por ordem manual.
export function finalizeProducts(
  config: CatalogConfig,
  rawProducts: CatalogProduct[],
): CatalogProduct[] {
  const excluded = new Set(config.excludedProductIds ?? []);
  const overrides = config.priceOverrides ?? {};
  const offers = config.offerOverrides ?? {};
  // Produtos da LISTA: o preço vive no item (fonte única) — overrides não se
  // aplicam a eles (evita override defasado divergir da lista).
  const listItemIds = new Set((config.list?.items ?? []).map((it) => it.id));
  let list = rawProducts
    .filter((p) => !excluded.has(p.id))
    .map((p) => {
      const isListItem = listItemIds.has(p.id);
      const override = isListItem ? undefined : overrides[p.id];
      const offer = isListItem ? undefined : offers[p.id];
      // "De" (normal) e "Por" (oferta) por-catálogo têm prioridade; `basePrice`
      // guarda o preço do cadastro para o riscado ("De" padrão).
      const salePrice =
        typeof override === "number" && override > 0 ? override : p.salePrice;
      const promotionalPrice =
        typeof offer === "number" && offer > 0 ? offer : p.promotionalPrice;
      if (
        salePrice === p.salePrice &&
        promotionalPrice === p.promotionalPrice
      ) {
        return { ...p, basePrice: p.salePrice };
      }
      const discount =
        promotionalPrice != null && salePrice > 0
          ? ((salePrice - promotionalPrice) / salePrice) * 100
          : null;
      const savings =
        promotionalPrice != null ? salePrice - promotionalPrice : null;
      return {
        ...p,
        salePrice,
        promotionalPrice,
        discount,
        savings,
        basePrice: p.salePrice,
      };
    });

  switch (config.sortBy) {
    case "discount-desc":
      list = [...list].sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
      break;
    case "savings-desc":
      list = [...list].sort((a, b) => (b.savings ?? 0) - (a.savings ?? 0));
      break;
    case "price-asc":
      list = [...list].sort(
        (a, b) =>
          (a.promotionalPrice ?? a.salePrice) -
          (b.promotionalPrice ?? b.salePrice),
      );
      break;
    case "price-desc":
      list = [...list].sort(
        (a, b) =>
          (b.promotionalPrice ?? b.salePrice) -
          (a.promotionalPrice ?? a.salePrice),
      );
      break;
    case "name-asc":
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  const order = config.productOrder ?? [];
  if (order.length > 0) {
    const pos = new Map(order.map((id, i) => [id, i]));
    list = [...list].sort(
      (a, b) =>
        (pos.get(a.id) ?? Number.POSITIVE_INFINITY) -
        (pos.get(b.id) ?? Number.POSITIVE_INFINITY),
    );
  }
  return list;
}

// Config efetiva de uma página (global + overrides da página).
export function effectivePageConfig(
  config: CatalogConfig,
  pageIndex: number,
): CatalogConfig {
  const pages = ensurePages(config);
  const pg = pages[pageIndex] ?? pages[0];
  return {
    ...config,
    layout: pg.layout,
    gridCols: pg.gridCols ?? config.gridCols,
    gridRows: pg.gridRows ?? config.gridRows,
    productGroup: pg.productGroup,
    productGroups: pg.productGroups,
    productGroupScale: pg.productGroupScale,
    backgroundColor: pg.backgroundColor,
    backgroundGradient: pg.backgroundGradient,
    backgroundOpacity: pg.backgroundOpacity,
    backgroundImage: pg.backgroundImage,
    backgroundFit: pg.backgroundFit,
    overlays: pg.overlays ?? [],
    texts: pg.texts ?? [],
    styleBlocks: pg.styleBlocks ?? [],
    dynamic: pg.dynamic,
    cardLayout: pg.cardLayout ?? config.cardLayout,
  };
}

// Distribui os produtos do grid pelas páginas (modo explícito ou automático) e
// devolve, por página, a config efetiva + a fatia de produtos do grid.
export function distributePages(
  config: CatalogConfig,
  products: CatalogProduct[],
): { cfg: CatalogConfig; products: CatalogProduct[] }[] {
  const pages = ensurePages(config);

  // Produtos consumidos por blocos de estilo — não entram no grid.
  const blockIds = new Set<string>();
  for (const pg of pages)
    for (const b of pg.styleBlocks ?? [])
      if (b.productId) blockIds.add(b.productId);
  const gridProducts = products.filter((p) => !blockIds.has(p.id));

  let chunks: CatalogProduct[][];
  const anyExplicit = pages.some((pg) => pg.productIds !== undefined);
  if (anyExplicit) {
    const claimed = new Set<string>();
    for (const pg of pages)
      for (const id of pg.productIds ?? []) claimed.add(id);
    chunks = pages.map((pg, i) => {
      const idSet = new Set(pg.productIds ?? []);
      let arr = gridProducts.filter((p) => idSet.has(p.id));
      if (i === pages.length - 1)
        arr = [...arr, ...gridProducts.filter((p) => !claimed.has(p.id))];
      return arr;
    });
  } else {
    chunks = [];
    let idx = 0;
    pages.forEach((pg, i) => {
      const per =
        pg.productGroups && pg.productGroups.length > 0
          ? pg.productGroups.reduce(
              (sum, g) =>
                sum + Math.max(1, g.gridCols) * Math.max(1, g.gridRows),
              0,
            )
          : getItemsPerPage(pg.layout, config.pageSize, {
              ...config,
              layout: pg.layout,
              gridCols: pg.gridCols ?? config.gridCols,
              gridRows: pg.gridRows ?? config.gridRows,
            });
      const isLast = i === pages.length - 1;
      chunks.push(
        isLast ? gridProducts.slice(idx) : gridProducts.slice(idx, idx + per),
      );
      idx += per;
    });
  }

  return pages.map((_, i) => ({
    cfg: effectivePageConfig(config, i),
    products: chunks[i] ?? [],
  }));
}
