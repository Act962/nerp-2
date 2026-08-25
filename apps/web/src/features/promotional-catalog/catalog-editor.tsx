"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Save,
  Share2,
  Package,
  LayoutTemplate,
  Sticker,
  Type,
  Tag,
  Shapes,
  Plus,
  Image as ImageIcon,
  Wallpaper,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigPanel } from "./components/config-panel";
import { CatalogPreview } from "./components/catalog-preview";
import { SelectionLayer } from "./components/selection-layer";
import { PageToolbar } from "./components/page-toolbar";
import { PageSearch } from "./components/page-search";
import { ShareDialog } from "./components/share-dialog";
import { CatalogListEditor } from "./components/catalog-list-editor";
import {
  usePromotionalCatalog,
  useAutosaveCatalog,
  usePromotionalProducts,
} from "./hooks/use-catalog";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useExport } from "./hooks/use-export";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { buildDynamicContext } from "./lib/resolve-entity";
import type {
  CardLayoutElement,
  CatalogConfig,
  CatalogPage,
  LayerRect,
  LayerSelection,
  ProductGroup,
} from "./types";
import {
  DEFAULT_CONFIG,
  PER_PAGE_KEYS,
  effectiveCardLayout,
  ensurePages,
  isOfferExpired,
  resolveFolders,
  virtualProductsFromList,
} from "./types";

const PAGE_W = 1080;
const PAGE_H_VALUES: Record<CatalogConfig["pageSize"], number> = {
  square: 1080,
  story: 1920,
  portrait: 1440,
};
// Altura da página: proporção EXATA (`pageAspect`) quando definida, senão o
// preset de `pageSize`.
const pageHeightOf = (c: CatalogConfig): number =>
  c.pageAspect && c.pageAspect > 0
    ? Math.round(PAGE_W / c.pageAspect)
    : PAGE_H_VALUES[c.pageSize];
// Espaço fixo do cabeçalho: h2 text-2xl (~36px) + mb-6 (24px) + subtitle (~20px)
const HEADER_H = 80;
// Margem de segurança: impede que a última linha corte o rodapé do canvas.
const BOTTOM_BUFFER = 32;
const GAP4 = 16; // gap-4 (Tailwind)
const GAP3 = 12; // gap-3

// Altura em px de cada opção de textSize (base para estimativa de line-height).
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

// Retorna a altura estimada de um card em pixels, considerando o cardStyle,
// largura disponível, tamanho de fonte e campos opcionais habilitados na config.
function estimateCardHeight(
  cardStyle: CatalogConfig["cardStyle"],
  cardWidth: number,
  config: CatalogConfig,
): number {
  // line-height ≈ 1.4× o font-size
  const lineH = (TEXT_SIZE_PX[config.textSize] ?? 16) * 1.4;

  switch (cardStyle) {
    case "compact":
      // h-16(64) + p-2*2(16) + border; nome em 1 linha
      return Math.max(90, 80 + lineH);
    case "list": {
      // h-20(80) + p-3*2(24) + border; nome + campos opcionais
      let h = Math.max(116, 80 + 24 + lineH);
      if (config.showCategory) h += lineH;
      if (config.showStock) h += lineH;
      return h;
    }
    case "minimal":
      // aspect-square + p-2*2(16) + nome(1 linha) + preço(1 linha)
      return cardWidth + 16 + lineH * 2 + 8;
    default: {
      // standard, countdown, badge-hot
      // p-3*2(24) + nome(2 linhas) + preço(1 linha)
      let contentH = 24 + lineH * 2 + lineH;
      if (config.showCategory) contentH += lineH;
      if (config.showSku) contentH += lineH;
      if (config.showDescription) contentH += lineH * 2; // line-clamp-2
      if (config.showStock) contentH += lineH;
      contentH += lineH * 2; // preço original riscado + economia (promo)
      return cardWidth + contentH;
    }
  }
}

// Calcula proporcionalmente quantos itens cabem por página, maximizando
// o aproveitamento do canvas considerando padding, cabeçalho e tamanho real dos cards.
function getItemsPerPage(
  layout: CatalogConfig["layout"],
  config: CatalogConfig,
): number {
  const pageH = pageHeightOf(config);
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
      // Disposição personalizada: itens por página = colunas × linhas.
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
      const rows = Math.floor(availH / (cardH + GAP3));
      return Math.max(1, rows);
    }
    case "table": {
      const cardH = estimateCardHeight(config.cardStyle, availW, config);
      return Math.max(1, Math.floor(availH / Math.max(1, cardH)));
    }
    case "carousel": {
      // horizontal: estima quantos cards são visíveis na largura disponível
      const cardW = Math.min(availW / 2, 280);
      return Math.max(4, Math.floor(availW / (cardW + GAP4)));
    }
    case "featured": {
      // 1º card: CardStandard em largura total; demais em grid-3
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

interface CatalogEditorProps {
  catalogId: string;
}

// Rail de ícones (estilo Canva) — as abas de config viram ícones na lateral.
const EDITOR_TABS = [
  { value: "produtos", label: "Página", icon: Package },
  { value: "lista", label: "Lista", icon: TableIcon },
  { value: "layout", label: "Layout", icon: LayoutTemplate },
  { value: "fundo", label: "Fundo", icon: Wallpaper },
  { value: "texto", label: "Texto", icon: Type },
  { value: "etiqueta", label: "Elementos", icon: Sticker },
  { value: "estilos", label: "Etiqueta", icon: Tag },
  { value: "padroes-sistema", label: "Padrões", icon: Shapes },
] as const;

export function CatalogEditor({ catalogId }: CatalogEditorProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const allPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Layer de exportação (todas as páginas em resolução cheia) — montado só na
  // hora de exportar, para não manter dezenas de previews na memória.
  const [exportMode, setExportMode] = useState(false);
  const exportLayerRef = useRef<HTMLDivElement | null>(null);
  // Um objeto-ref estável por página visível (lista vertical), para o
  // SelectionLayer de cada página medir seu próprio canvas.
  const pageRefs = useRef<{ current: HTMLDivElement | null }[]>([]);
  // Container de scroll + caixa de cada página (lista vertical) — para detectar
  // a página em foco ao rolar e sincronizar a aba Produtos com ela.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageBoxRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Prévia da aba "Lista" — paginada (uma página por vez, sem sobrecarregar).
  const [previewPage, setPreviewPage] = useState(0);

  const { data: catalogData, isLoading } = usePromotionalCatalog(catalogId);
  const autosave = useAutosaveCatalog();

  // Aba ativa (rail) + painel de config aberto/retraído (só no desktop).
  const [activeTab, setActiveTab] = useState<string>("produtos");
  const [panelOpen, setPanelOpen] = useState(true);
  // Sinal p/ abrir o diálogo "Adicionar produto" (botão do estado vazio).
  const [addProductSignal, setAddProductSignal] = useState(0);
  // Pedido para abrir "Editar produto" (duplo clique no card da página). O
  // `nonce` força o efeito no ConfigPanel a reagir mesmo ao reeditar o mesmo id.
  const [editProductRequest, setEditProductRequest] = useState<{
    id: string;
    nonce: number;
    entry?: "photo" | "label";
    elementId?: string;
  } | null>(null);
  const requestEditProduct = (
    id: string,
    opts?: { entry?: "photo" | "label"; elementId?: string },
  ) => {
    setActiveTab("produtos");
    setPanelOpen(true);
    setEditProductRequest((r) => ({
      id,
      nonce: (r?.nonce ?? 0) + 1,
      entry: opts?.entry ?? "label",
      elementId: opts?.elementId,
    }));
  };

  // Ao entrar no editor (desktop), retrai a sidebar do app pra dar espaço —
  // uma única vez; o usuário reabre pelo botão de retrair no header.
  const { setOpen: setSidebarOpen, isMobile } = useSidebar();
  const sidebarCollapsedRef = useRef(false);
  useEffect(() => {
    if (!isMobile && !sidebarCollapsedRef.current) {
      sidebarCollapsedRef.current = true;
      setSidebarOpen(false);
    }
  }, [isMobile, setSidebarOpen]);

  const [config, setConfig] = useState<CatalogConfig>(DEFAULT_CONFIG);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  // Hidrata a config do servidor UMA vez (no load). Depois disso o cliente é
  // dono da config — um refetch nunca sobrescreve edições em andamento.
  const hydratedRef = useRef(false);
  const savedConfigRef = useRef<CatalogConfig | null>(null);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (catalogData?.config) {
      const merged = {
        ...DEFAULT_CONFIG,
        ...(catalogData.config as Partial<CatalogConfig>),
      };
      // Migra catálogos antigos: se não há páginas, cria a página 1 a partir
      // da config global.
      const loaded = { ...merged, pages: ensurePages(merged) };
      setConfig(loaded);
      savedConfigRef.current = loaded;
      hydratedRef.current = true;
    }
  }, [catalogData?.config]);

  // Fetch estável: excludedProductIds e sortBy não entram na query key.
  // Mudar esses campos nunca dispara um novo fetch — o useMemo abaixo
  // recalcula em tempo real, garantindo UI otimista sem reset.
  const { suppliers } = useSupplier();

  const { data: rawProducts = [] } = usePromotionalProducts({
    manuallyAddedIds: config.manuallyAddedIds,
    categoryFilter: config.categoryFilter,
    autoPromotions: config.autoPromotions,
  });

  const products = useMemo(() => {
    const excluded = new Set(config.excludedProductIds);
    const overrides = config.priceOverrides ?? {};
    const offers = config.offerOverrides ?? {};
    // Produtos VIRTUAIS da aba "Lista": o preço vive no próprio item (fonte
    // única). Overrides NUNCA se aplicam a eles — senão um override defasado
    // sombrearia o preço da lista (De/Por da lista e da página divergiriam).
    const listItemIds = new Set((config.list?.items ?? []).map((it) => it.id));
    const pool = [...rawProducts, ...virtualProductsFromList(config.list)];
    let list = pool
      .filter((p) => !excluded.has(p.id))
      .map((p) => {
        // "De" (normal) e "Por" (oferta) sobrescritos SÓ neste catálogo —
        // recalcula desconto/economia. `basePrice` guarda o do cadastro.
        const isListItem = listItemIds.has(p.id);
        const override = isListItem ? undefined : overrides[p.id];
        const offer = isListItem ? undefined : offers[p.id];
        const salePrice =
          typeof override === "number" && override > 0 ? override : p.salePrice;
        const promotionalPrice =
          typeof offer === "number" && offer > 0 ? offer : p.promotionalPrice;
        if (
          salePrice === p.salePrice &&
          promotionalPrice === p.promotionalPrice
        )
          return { ...p, basePrice: p.salePrice };
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

    // Ordem manual tem prioridade sobre `sortBy`. Para catálogos de LISTA, a
    // fonte única da ordem é `list.items` (ordem da lista) — assim reordenar na
    // lista OU na página reflete nos dois ao vivo. Sem lista, usa `productOrder`.
    const order =
      config.list?.items && config.list.items.length > 0
        ? config.list.items.map((it) => it.id)
        : (config.productOrder ?? []);
    if (order.length > 0) {
      const pos = new Map(order.map((id, i) => [id, i]));
      list = [...list].sort(
        (a, b) =>
          (pos.get(a.id) ?? Number.POSITIVE_INFINITY) -
          (pos.get(b.id) ?? Number.POSITIVE_INFINITY),
      );
    }

    return list;
  }, [
    rawProducts,
    config.list,
    config.excludedProductIds,
    config.sortBy,
    config.priceOverrides,
    config.offerOverrides,
    config.productOrder,
  ]);

  // Paginação — quantos itens cabem por página (calculado proporcionalmente)
  const selectedSupplierLogos = useMemo(() => {
    const ids = new Set(config.footerSupplierIds ?? []);
    return suppliers
      .filter((s) => ids.has(s.id) && s.logo)
      .map((s) => ({ id: s.id, name: s.tradeName || s.name, logo: s.logo! }));
  }, [suppliers, config.footerSupplierIds]);

  // ── Páginas (estilo Canva): cada uma tem Disposição/Fundo/Etiquetas próprios;
  // os produtos ainda fluem automaticamente por elas (Fase 1). ──
  const pages = useMemo(() => ensurePages(config), [config]);

  // ── Páginas DINÂMICAS: resolve as entidades (loja/org/usuário/produto) de
  // cada página para os textos/etiquetas com `binding`. Loja casa pelo nome da
  // página (ou refId); org = org do catálogo; usuário = sessão (fase 1). ──
  const anyDynamic = useMemo(() => pages.some((p) => p.dynamic), [pages]);
  // Todas as páginas são dinâmicas? (para o toggle "Todas as páginas dinâmicas".)
  const allPagesDynamic = useMemo(
    () => pages.length > 0 && pages.every((p) => !!p.dynamic),
    [pages],
  );
  // Aplica (ou remove, com `undefined`) o mesmo vínculo dinâmico a TODAS as
  // páginas de uma vez. Loja com `auto` casa cada página pelo seu próprio nome.
  const setAllPagesDynamic = (dynamic: CatalogPage["dynamic"]) => {
    setConfig((prev) => {
      const pgs = ensurePages(prev);
      return { ...prev, pages: pgs.map((p) => ({ ...p, dynamic })) };
    });
    toast.success(
      dynamic
        ? "Todas as páginas agora são dinâmicas."
        : "Modo dinâmico removido de todas as páginas.",
    );
  };
  const { stores } = useStores({ pageSize: 100 });
  const { data: orgData } = useQuery({
    ...orpc.org.get.queryOptions({ input: undefined }),
    enabled: anyDynamic,
  });
  const { data: session } = authClient.useSession();
  const dynamicContexts = useMemo(() => {
    const org = orgData?.organization
      ? {
          name: orgData.organization.name,
          tradeName: orgData.organization.tradeName,
          sigla: orgData.organization.sigla,
          city: orgData.organization.city,
          state: orgData.organization.state,
          logo: orgData.organization.logo,
        }
      : null;
    const sessionUser = session?.user
      ? {
          name: session.user.name,
          email: session.user.email ?? null,
          whatsapp: null,
          image: session.user.image ?? null,
        }
      : null;
    return pages.map((pg) =>
      buildDynamicContext(pg.dynamic, pg.name, {
        stores,
        org,
        sessionUser,
        products,
      }),
    );
  }, [pages, stores, orgData, session, products]);

  // Validade por página: o compartilhamento só é bloqueado quando TODAS as
  // páginas estão vencidas (cada página tem seu próprio prazo). O aviso no
  // preview é por página (`pageExpired`, abaixo).
  const offerExpired =
    pages.length > 0 && pages.every((p) => isOfferExpired(p));

  const [currentPage, setCurrentPage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Camada selecionada no canvas (Fundo/Grupo/Card/Elemento).
  const [selection, setSelection] = useState<LayerSelection>(null);

  // Histórico de edições (desfazer/refazer, estilo Canva). Guarda snapshots da
  // config; grava quando a edição "assenta" (debounce) para agrupar arrastes.
  const [history, setHistory] = useState<{
    past: CatalogConfig[];
    future: CatalogConfig[];
  }>({ past: [], future: [] });
  const isUndoRedo = useRef(false);
  const lastSettled = useRef<CatalogConfig | null>(null);

  const totalPages = pages.length;
  const safePage = Math.min(currentPage, totalPages - 1);
  // Prévia da Lista (paginada): página atual + pasta correspondente (rodapé).
  const safePreview = Math.max(0, Math.min(previewPage, totalPages - 1));
  // Pasta da prévia = a PÁGINA atual (a Lista organiza por página).
  const previewFolderKey = pages[safePreview]?.id ?? null;
  // Título dinâmico da prévia: nome da entidade vinculada (loja/produto/…) ou o
  // nome da página (cliente/pasta).
  const previewDyn = dynamicContexts[safePreview];
  const previewTitle =
    previewDyn?.store?.name ??
    previewDyn?.product?.name ??
    previewDyn?.user?.name ??
    previewDyn?.org?.name ??
    pages[safePreview]?.name ??
    `Página ${safePreview + 1}`;

  // Config efetiva de uma página = global + overrides (layout, fundo, etiquetas).
  const configForPage = (pageIndex: number): CatalogConfig => {
    const pg = pages[pageIndex] ?? pages[0];
    return {
      ...config,
      layout: pg.layout,
      gridCols: pg.gridCols ?? config.gridCols,
      gridRows: pg.gridRows ?? config.gridRows,
      centerLastRow: pg.centerLastRow ?? config.centerLastRow,
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
      // Card efetivo da página: override da página > global.
      cardLayout: pg.cardLayout ?? config.cardLayout,
    };
  };
  const currentConfig = configForPage(safePage);

  // Produtos que estão ligados a um bloco de estilo (em qualquer página). Eles
  // são exibidos PELO bloco, então NÃO entram na distribuição do grid — senão
  // apareceriam duplicados (como card do grid numa página e como bloco noutra).
  const blockProductIds = useMemo(() => {
    const s = new Set<string>();
    for (const pg of pages)
      for (const b of pg.styleBlocks ?? []) if (b.productId) s.add(b.productId);
    return s;
  }, [pages]);

  // Produtos que fluem no grid = todos menos os consumidos por blocos de estilo.
  const gridProducts = useMemo(
    () => products.filter((p) => !blockProductIds.has(p.id)),
    [products, blockProductIds],
  );

  // Distribui os produtos do grid pelas páginas.
  const pageChunks = useMemo(() => {
    // Modo EXPLÍCITO: ao menos uma página tem `productIds` fixados. Cada página
    // mostra só os seus (na ordem global, respeitando reordenação/sortBy); a
    // última recolhe os não atribuídos (produtos novos). Inserir/remover página
    // não mexe nos produtos das outras.
    const anyExplicit = pages.some((pg) => pg.productIds !== undefined);
    if (anyExplicit) {
      const claimed = new Set<string>();
      for (const pg of pages)
        for (const id of pg.productIds ?? []) claimed.add(id);
      return pages.map((pg, i) => {
        const idSet = new Set(pg.productIds ?? []);
        let arr = gridProducts.filter((p) => idSet.has(p.id));
        if (i === pages.length - 1)
          arr = [...arr, ...gridProducts.filter((p) => !claimed.has(p.id))];
        return arr;
      });
    }

    // Modo AUTOMÁTICO (padrão): sequencial por capacidade; a última recebe o
    // restante. Fase 1: sem seleção por página.
    const chunks: (typeof products)[] = [];
    let idx = 0;
    pages.forEach((pg, i) => {
      // Modo multi-grupo: a página consome a soma das capacidades dos grupos
      // (cols×linhas de cada um). Modo grupo-único: capacidade da Disposição.
      const per =
        pg.productGroups && pg.productGroups.length > 0
          ? pg.productGroups.reduce(
              (sum, g) =>
                sum + Math.max(1, g.gridCols) * Math.max(1, g.gridRows),
              0,
            )
          : getItemsPerPage(pg.layout, {
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
    return chunks;
  }, [gridProducts, pages, config]);

  // Produtos da página atual = os do grid + os ligados aos blocos de estilo
  // desta página (que aparecem pelo bloco). Sem repetição.
  const pageProducts = useMemo(() => {
    const grid = pageChunks[safePage] ?? [];
    const seen = new Set(grid.map((p) => p.id));
    const blockProds = (pages[safePage]?.styleBlocks ?? [])
      .map((b) => products.find((p) => p.id === b.productId))
      .filter((p): p is (typeof products)[number] => !!p && !seen.has(p.id));
    return [...grid, ...blockProds];
  }, [pageChunks, safePage, pages, products]);

  // Corrige a página atual quando o total de páginas diminui.
  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  // Reconciliador idempotente das páginas. `pages[].productIds` é a FONTE ÚNICA
  // de qual produto está em qual página (Lista e Página leem daqui). NÃO reordena
  // nem re-bucketiza por pasta (isso causava a "troca de modo"). Rede de
  // segurança: item da lista que não está em NENHUMA página vai para a atual.
  // (Deleção é feita explicitamente nos handlers, então não precisa varrer aqui.)
  // biome-ignore lint/correctness/useExhaustiveDependencies: idempotente; reage a produtos/lista/páginas.
  useEffect(() => {
    const pgs = config.pages ?? [];
    if (pgs.length === 0) return;
    const knownIds = new Set(products.map((p) => p.id));
    const placed = new Set<string>();
    for (const pg of pgs) for (const id of pg.productIds ?? []) placed.add(id);
    const orphans = (config.list?.items ?? [])
      .map((it) => it.id)
      .filter((id) => knownIds.has(id) && !placed.has(id));
    if (orphans.length === 0) return;
    setConfig((prev) => {
      const p = prev.pages ?? [];
      if (p.length === 0) return prev;
      const idx = Math.min(safePage, p.length - 1);
      return {
        ...prev,
        pages: p.map((pg, i) => {
          if (i !== idx) return pg;
          const cur = pg.productIds ?? [];
          return {
            ...pg,
            productIds: [...cur, ...orphans.filter((id) => !cur.includes(id))],
          };
        }),
      };
    });
  }, [products, config.list, config.pages, safePage]);

  // Higiene: produtos da LISTA não devem ter override de preço (o preço vive no
  // item). Remove entradas defasadas de priceOverrides/offerOverrides que apontem
  // para ids de itens da lista — senão sombreariam o preço da lista.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só limpa quando há chaves a remover; idempotente.
  useEffect(() => {
    const listItemIds = new Set((config.list?.items ?? []).map((it) => it.id));
    if (listItemIds.size === 0) return;
    const po = config.priceOverrides ?? {};
    const oo = config.offerOverrides ?? {};
    const poHas = Object.keys(po).some((id) => listItemIds.has(id));
    const ooHas = Object.keys(oo).some((id) => listItemIds.has(id));
    if (!poHas && !ooHas) return;
    setConfig((prev) => ({
      ...prev,
      priceOverrides: Object.fromEntries(
        Object.entries(prev.priceOverrides ?? {}).filter(
          ([id]) => !listItemIds.has(id),
        ),
      ),
      offerOverrides: Object.fromEntries(
        Object.entries(prev.offerOverrides ?? {}).filter(
          ([id]) => !listItemIds.has(id),
        ),
      ),
    }));
  }, [config.list, config.priceOverrides, config.offerOverrides]);

  // Página em foco segue o SCROLL: a aba Produtos mostra os produtos da página
  // mais visível na lista vertical. Observa cada caixa de página no container.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.pageIndex ?? -1);
          if (idx >= 0) ratios.set(idx, e.intersectionRatio);
        }
        let best = -1;
        let bestRatio = 0;
        for (const [idx, r] of ratios) {
          if (r > bestRatio) {
            bestRatio = r;
            best = idx;
          }
        }
        if (best >= 0) setCurrentPage(best);
      },
      { root, threshold: [0, 0.15, 0.3, 0.5, 0.7, 0.9] },
    );
    for (const el of pageBoxRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [totalPages]);

  // Prévia da aba "Lista" paginada: clampa a página quando o total muda.
  useEffect(() => {
    setPreviewPage((p) => Math.max(0, Math.min(p, totalPages - 1)));
  }, [totalPages]);

  // Limpa a seleção ao trocar de página (ids de card/elemento são por página).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setSelection(null), [safePage]);

  // Miniatura JPEG (~380px) da página atual do preview — usada na lista de
  // catálogos e ao salvar um padrão. As fotos já são data URL no DOM, então o
  // html-to-image captura sem CORS.
  const captureThumbnail = async (): Promise<string> => {
    const el = previewRef.current;
    if (!el) return "";
    try {
      const { toJpeg } = await import("html-to-image");
      return await toJpeg(el, {
        pixelRatio: 0.35,
        quality: 0.7,
        skipFonts: true,
        cacheBust: false,
      });
    } catch {
      return "";
    }
  };

  // PNG de UMA página (resolução cheia, 1080px) — para copiar/compartilhar.
  // Monta o layer de exportação sob demanda (e desmonta ao terminar).
  const capturePage = async (index: number): Promise<string> => {
    await prepareExport();
    try {
      const el = allPageRefs.current[index] ?? previewRef.current;
      if (!el) return "";
      const { toPng } = await import("html-to-image");
      return await toPng(el, {
        pixelRatio: 1,
        skipFonts: true,
        cacheBust: false,
      });
    } catch {
      return "";
    } finally {
      finishExport();
    }
  };

  // Monta o layer de exportação e espera as imagens (data-URLs) ficarem prontas
  // — senão o html-to-image captura antes das fotos/fundo ou com taint de CORS.
  const waitForExportReady = async () => {
    const deadline = Date.now() + 12000;
    // URL http(s) que NÃO é do nosso domínio (o html-to-image não consegue
    // embutir — vira placeholder/some no PNG).
    const isExternal = (s: string) =>
      s.startsWith("http") && !s.startsWith(window.location.origin);
    while (Date.now() < deadline) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const el = exportLayerRef.current;
      if (el) {
        const imgs = [...el.querySelectorAll("img")];
        const imgsReady =
          imgs.every((i) => i.complete) &&
          !imgs.some((i) => isExternal(i.currentSrc || i.src));
        // O FUNDO da página é um CSS background-image (div, não <img>). Precisa
        // esperar virar data URL — a marca d'água (<img>) satisfazia o gate
        // antigo e o capture saía antes do fundo embutir.
        const bgReady = ![
          ...el.querySelectorAll<HTMLElement>("[style*='background-image']"),
        ].some((n) => {
          const m = (n.style.backgroundImage || "").match(
            /url\((['"]?)(.*?)\1\)/,
          );
          return m ? isExternal(m[2]) : false;
        });
        if (imgsReady && bgReady) {
          await new Promise((r) => setTimeout(r, 150));
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  };
  const prepareExport = async () => {
    setExportMode(true);
    await waitForExportReady();
  };
  const finishExport = () => setExportMode(false);

  // Autosave da config — leve e ágil (estilo Canva): payload só da config, sem
  // miniatura no caminho crítico e sem invalidar nada. Debounce curto coalesce
  // várias mudanças seguidas num único save em background.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (config === savedConfigRef.current) return; // nada mudou desde o load/save
    setSaveStatus("saving");
    const snapshot = config;
    const timer = setTimeout(() => {
      autosave.mutate(
        { id: catalogId, config: snapshot as Record<string, unknown> },
        {
          onSuccess: () => {
            savedConfigRef.current = snapshot;
            setSaveStatus("saved");
          },
          onError: () => setSaveStatus("idle"),
        },
      );
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Miniatura para a lista de catálogos — cara (html-to-image), então roda num
  // debounce longo e separado, só quando a edição estabiliza. Nunca trava o
  // layout: o autosave da config já persistiu tudo antes disso.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = setTimeout(async () => {
      const thumbnail = await captureThumbnail();
      if (thumbnail) autosave.mutate({ id: catalogId, thumbnail });
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Grava um snapshot no histórico quando a config "assenta" (500ms sem novas
  // mudanças) — assim um arraste inteiro vira UM passo de desfazer. Pula quando
  // a mudança veio de um desfazer/refazer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      lastSettled.current = config;
      return;
    }
    const timer = setTimeout(() => {
      const prev = lastSettled.current;
      if (prev === config) return;
      lastSettled.current = config;
      if (prev) {
        setHistory((h) => ({ past: [...h.past, prev].slice(-50), future: [] }));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [config]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const undo = () => {
    if (!history.past.length) return;
    const prev = history.past[history.past.length - 1];
    isUndoRedo.current = true;
    setHistory((h) => ({
      past: h.past.slice(0, -1),
      future: [config, ...h.future].slice(0, 50),
    }));
    setConfig(prev);
  };
  const redo = () => {
    if (!history.future.length) return;
    const next = history.future[0];
    isUndoRedo.current = true;
    setHistory((h) => ({
      past: [...h.past, config].slice(-50),
      future: h.future.slice(1),
    }));
    setConfig(next);
  };
  // Atalhos Ctrl/Cmd+Z (desfazer) e Shift+Ctrl/Cmd+Z / Ctrl+Y (refazer). Usa
  // refs para sempre chamar a versão mais recente sem re-registrar o listener.
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redoRef.current();
        else undoRef.current();
      } else if (key === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const {
    exportAsPng,
    exportAsPdf,
    exportPageAsPng,
    exportPageAsPdf,
    printPage,
    isExporting,
  } = useExport({
    previewRef,
    allPageRefs,
    totalPages,
    catalogName: catalogData?.name ?? "catalogo",
    pageSize: config.pageSize,
    prepareExport,
    finishExport,
  });

  // Roteia mudanças: campos de aparência POR PÁGINA (layout, fundo, etiquetas)
  // vão para a página atual; o resto continua global. Página bloqueada ignora
  // os campos por página.
  const perPageKeySet = new Set<string>(PER_PAGE_KEYS);
  const applyConfigChange = (
    prev: CatalogConfig,
    changes: Partial<CatalogConfig>,
    targetPage: number,
  ): CatalogConfig => {
    const globalChanges: Record<string, unknown> = {};
    const pageChanges: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (perPageKeySet.has(key)) pageChanges[key] = value;
      else globalChanges[key] = value;
    }
    if (Object.keys(pageChanges).length === 0) {
      return { ...prev, ...globalChanges };
    }
    const prevPages = ensurePages(prev);
    const idx = Math.min(targetPage, prevPages.length - 1);
    if (prevPages[idx]?.locked) {
      return { ...prev, ...globalChanges };
    }
    const nextPages = prevPages.map((pg, i) =>
      i === idx ? { ...pg, ...pageChanges } : pg,
    );
    return { ...prev, ...globalChanges, pages: nextPages };
  };
  // Edição vinda do painel lateral → afeta a página em foco (safePage).
  const handleConfigChange = (changes: Partial<CatalogConfig>) => {
    setConfig((prev) => {
      const next = applyConfigChange(prev, changes, safePage);
      // Produto recém-adicionado é atribuído à PÁGINA ATUAL. Se ainda estiver em
      // modo automático (nenhuma página explícita), CONGELA a distribuição atual
      // de cada página primeiro — senão o novo (e os já existentes) cairiam todos
      // na página 1/última pela capacidade. `pages[].productIds` é a fonte única.
      if (changes.manuallyAddedIds) {
        const before = new Set(prev.manuallyAddedIds ?? []);
        const added = changes.manuallyAddedIds.filter((id) => !before.has(id));
        if (added.length > 0) {
          const frozen = ensurePages(next).map((p, i) =>
            p.productIds !== undefined
              ? p
              : { ...p, productIds: (pageChunks[i] ?? []).map((pp) => pp.id) },
          );
          return {
            ...next,
            pages: frozen.map((p, i) => {
              if (i !== safePage) return p;
              const cur = p.productIds ?? [];
              const merged = [
                ...cur,
                ...added.filter((id) => !cur.includes(id)),
              ];
              return { ...p, productIds: merged };
            }),
          };
        }
      }
      return next;
    });
  };
  // Edição vinda de uma página específica (lista vertical) → afeta aquela página.
  const handlePageConfigChange = (
    pageIndex: number,
    changes: Partial<CatalogConfig>,
  ) => {
    setConfig((prev) => applyConfigChange(prev, changes, pageIndex));
  };

  // Gera o catálogo a partir da aba "Lista": uma página por PASTA (agrupamento
  // configurável — cliente/departamento/custom), grade custom 3×ceil(max/3),
  // último item centralizado (loneLast).
  // `override` = config já resolvido (usado pelo wizard, que acabou de montar a
  // lista/fundo e não pode esperar o flush do setState).
  const generateCatalogFromList = (override?: CatalogConfig) => {
    const source = override ?? config;
    const list = source.list;
    if (!list?.items?.length) {
      toast.error("Importe uma lista primeiro.");
      return;
    }
    const folders = resolveFolders(list);
    const counts = folders.map((f) => f.itemIds.length);
    const maxCount = list.maxPerPage ?? Math.max(1, ...counts);
    const gridCols = 3;
    const gridRows = Math.max(1, Math.ceil(maxCount / gridCols));
    // Elementos DINÂMICOS do PADRÃO (logo da loja, nome do cliente…): entram em
    // TODA página nova (clonados com id próprio). Se o padrão era dinâmico,
    // marca cada página como dinâmica (auto por loja) pra os bindings resolverem.
    const seedDyn = source.templateDynamic;
    const pageDynamic = source.dynamic
      ? { type: source.dynamic.type, auto: source.dynamic.type === "store" }
      : seedDyn
        ? { type: "store" as const, auto: true }
        : undefined;
    const pages: CatalogPage[] = folders.map((f, i) => ({
      id: `list-page-${i}`,
      name: f.name,
      locked: false,
      layout: "custom",
      gridCols,
      gridRows,
      backgroundColor: source.backgroundColor,
      backgroundGradient: source.backgroundGradient,
      backgroundOpacity: source.backgroundOpacity,
      backgroundImage: source.backgroundImage,
      backgroundFit: source.backgroundFit,
      overlays: (seedDyn?.overlays ?? []).map((o) => ({
        ...o,
        id: crypto.randomUUID(),
      })),
      texts: (seedDyn?.texts ?? []).map((t) => ({
        ...t,
        id: crypto.randomUUID(),
      })),
      ...(pageDynamic ? { dynamic: pageDynamic } : {}),
      productIds: f.itemIds,
    }));
    setConfig((prev) => ({
      ...(override ?? prev),
      layout: "custom",
      gridCols,
      gridRows,
      pages,
      // A ordem dos produtos vem de `list.items` (fonte única) — ver o useMemo
      // `products`. Regenerar não precisa mais fixar `productOrder`.
    }));
    setActiveTab("produtos");
    setCurrentPage(0);
    setSelection(null);
    toast.success(`Catálogo gerado: ${pages.length} página(s).`);
  };

  // Copia a APARÊNCIA da página atual (layout + posição da grade + fundo) para
  // TODAS as páginas ("Aplicar padrão para todas as páginas" em Layout). NÃO
  // copia etiquetas/textos ESTÁTICOS (conteúdo fixo por página) nem os produtos,
  // mas REPLICA as etiquetas/textos DINÂMICOS (com `binding`) — eles fazem parte
  // do padrão e resolvem o dado de cada página automaticamente no render.
  const applyStyleToAllPages = () => {
    setConfig((prev) => {
      const pgs = ensurePages(prev);
      if (pgs.length <= 1) return prev;
      const srcIndex = Math.min(safePage, pgs.length - 1);
      const cur = pgs[srcIndex];
      if (!cur) return prev;
      const style = {
        layout: cur.layout,
        gridCols: cur.gridCols,
        gridRows: cur.gridRows,
        centerLastRow: cur.centerLastRow,
        productGroup: cur.productGroup,
        productGroups: cur.productGroups,
        productGroupScale: cur.productGroupScale,
        backgroundColor: cur.backgroundColor,
        backgroundGradient: cur.backgroundGradient,
        backgroundOpacity: cur.backgroundOpacity,
        backgroundImage: cur.backgroundImage,
        backgroundFit: cur.backgroundFit,
      };
      // Dinâmicos da página fonte, replicados em cada página com id próprio.
      const dynOverlays = (cur.overlays ?? []).filter((o) => o.binding);
      const dynTexts = (cur.texts ?? []).filter((t) => t.binding);
      return {
        ...prev,
        pages: pgs.map((p, i) => {
          const base = { ...p, ...style };
          if (i === srcIndex) return base; // fonte mantém seus dinâmicos
          // Preserva os ESTÁTICOS da página e troca os dinâmicos pelos do padrão
          // (idempotente: reaplicar não acumula duplicatas).
          const staticOverlays = (p.overlays ?? []).filter((o) => !o.binding);
          const staticTexts = (p.texts ?? []).filter((t) => !t.binding);
          return {
            ...base,
            overlays: [
              ...staticOverlays,
              ...dynOverlays.map((o) => ({ ...o, id: crypto.randomUUID() })),
            ],
            texts: [
              ...staticTexts,
              ...dynTexts.map((t) => ({ ...t, id: crypto.randomUUID() })),
            ],
          };
        }),
      };
    });
    toast.success("Padrão aplicado a todas as páginas.");
  };

  // Salvar o card livre ("Montar card") com escopo escolhido pelo usuário.
  const handleSaveCardLayout = (
    scope: "product" | "page" | "all",
    layout: CardLayoutElement[],
    productId: string,
  ) => {
    setConfig((prev) => {
      if (scope === "product") {
        return {
          ...prev,
          cardLayoutOverrides: {
            ...(prev.cardLayoutOverrides ?? {}),
            [productId]: layout,
          },
        };
      }
      const pgs = ensurePages(prev);
      if (scope === "page") {
        // Só esta página; remove o override deste produto p/ o card da página valer.
        const overrides = { ...(prev.cardLayoutOverrides ?? {}) };
        delete overrides[productId];
        return {
          ...prev,
          cardLayoutOverrides: overrides,
          pages: pgs.map((p, i) =>
            i === safePage ? { ...p, cardLayout: layout } : p,
          ),
        };
      }
      // "all": card global; limpa overrides de página e o do produto atual.
      const overrides = { ...(prev.cardLayoutOverrides ?? {}) };
      delete overrides[productId];
      return {
        ...prev,
        cardLayout: layout,
        cardLayoutOverrides: overrides,
        pages: pgs.map((p) => ({ ...p, cardLayout: undefined })),
      };
    });
  };

  // Duplicar/materializar grupo de produtos. No modo grupo único (`sourceId`
  // ausente), materializa 2 grupos posicionáveis a partir do retângulo atual;
  // no multi, acrescenta um grupo (cópia) ao lado (ou abaixo, se não couber).
  const handleGroupDuplicate = (
    pageIndex: number,
    source: { rect: LayerRect; gridCols: number; gridRows: number },
  ) => {
    const page = pages[pageIndex] ?? pages[0];
    const existing = page?.productGroups ?? [];
    const pageH = pageHeightOf(config);
    const gap = 24;
    const { rect } = source;
    const besideX = rect.x + rect.w + gap;
    const nextRect: LayerRect =
      besideX + rect.w <= PAGE_W
        ? { ...rect, x: besideX }
        : {
            ...rect,
            y: Math.min(rect.y + rect.h + gap, Math.max(0, pageH - rect.h)),
          };
    const newGroup: ProductGroup = {
      id: crypto.randomUUID(),
      rect: nextRect,
      gridCols: source.gridCols,
      gridRows: source.gridRows,
    };
    const nextGroups: ProductGroup[] =
      existing.length > 0
        ? [...existing, newGroup]
        : [
            {
              id: crypto.randomUUID(),
              rect: source.rect,
              gridCols: source.gridCols,
              gridRows: source.gridRows,
            },
            newGroup,
          ];
    handlePageConfigChange(pageIndex, { productGroups: nextGroups });
    setCurrentPage(pageIndex);
    setSelection({ kind: "group", id: newGroup.id });
  };

  // Seleciona uma camada no canvas e abre a aba de edição correspondente
  // (estilo Canva: clicar num elemento abre onde ele se edita).
  const handleSelectionChange = (next: LayerSelection) => {
    setSelection(next);
    if (!next) return;
    if (next.kind === "element") setActiveTab("etiqueta");
    else if (next.kind === "text") setActiveTab("texto");
    else if (next.kind === "card") setActiveTab("produtos");
    else if (next.kind === "styleBlock") setActiveTab("estilos");
    else if (next.kind === "background")
      setActiveTab("fundo"); // fundo da página
    else if (next.kind === "group" && next.id)
      setActiveTab("produtos"); // grupo nomeado → aba "Página" (mostra o grupo)
    else setActiveTab("layout"); // grade padrão de produtos edita na aba Layout
    setPanelOpen(true);
  };

  // ── Ações de página (estilo Canva). Cada ação recebe o índice da página. ──
  const [deletePageIndex, setDeletePageIndex] = useState<number | null>(null);
  // Grupo de produtos a excluir (com confirmação): página + id do grupo.
  // `groupId` ausente = grupo ÚNICO da página (esvazia os produtos da página).
  const [deleteGroup, setDeleteGroup] = useState<{
    pageIndex: number;
    groupId?: string;
  } | null>(null);
  const confirmDeleteGroup = () => {
    if (!deleteGroup) return;
    const { pageIndex, groupId } = deleteGroup;
    if (groupId) {
      // Excluir um grupo nomeado: remove o grupo E os produtos dele (exclui os
      // ids), mantendo os DEMAIS produtos da página. Mesmo comportamento do
      // botão de lixeira no card "Grupos da página" (removeGroup no painel).
      const grp = (pages[pageIndex]?.productGroups ?? []).find(
        (g) => g.id === groupId,
      );
      const groupIds = grp?.productIds ?? [];
      const groupSet = new Set(groupIds);
      setConfig((prev) => ({
        ...prev,
        manuallyAddedIds: (prev.manuallyAddedIds ?? []).filter(
          (id) => !groupSet.has(id),
        ),
        excludedProductIds: [
          ...new Set([...(prev.excludedProductIds ?? []), ...groupIds]),
        ],
        pages: ensurePages(prev).map((pg, i) =>
          i === pageIndex
            ? {
                ...pg,
                productGroups: (pg.productGroups ?? []).filter(
                  (g) => g.id !== groupId,
                ),
                productIds: (pg.productIds ?? []).filter(
                  (id) => !groupSet.has(id),
                ),
                styleBlocks: (pg.styleBlocks ?? []).filter(
                  (b) => !b.productId || !groupSet.has(b.productId),
                ),
              }
            : pg,
        ),
      }));
    } else {
      // Grupo único: remove os produtos DESTA página (esvazia a grade), sem
      // redistribuir para as outras — congela a distribuição e exclui os ids.
      setConfig((prev) => {
        const frozen = ensurePages(prev).map((pg, i) =>
          pg.productIds !== undefined
            ? pg
            : { ...pg, productIds: (pageChunks[i] ?? []).map((p) => p.id) },
        );
        const removed = frozen[pageIndex];
        const removedIds = [
          ...(removed?.productIds ?? []),
          ...(removed?.styleBlocks ?? [])
            .map((b) => b.productId)
            .filter((id): id is string => !!id),
        ];
        const removedSet = new Set(removedIds);
        return {
          ...prev,
          manuallyAddedIds: (prev.manuallyAddedIds ?? []).filter(
            (id) => !removedSet.has(id),
          ),
          excludedProductIds: [
            ...new Set([...(prev.excludedProductIds ?? []), ...removedIds]),
          ],
          pages: frozen.map((pg, i) =>
            i === pageIndex ? { ...pg, productIds: [], styleBlocks: [] } : pg,
          ),
        };
      });
    }
    setSelection(null);
    setDeleteGroup(null);
  };
  const updatePages = (updater: (pages: CatalogPage[]) => CatalogPage[]) => {
    setConfig((prev) => ({ ...prev, pages: updater(ensurePages(prev)) }));
  };

  // FAB "+": adicionar produto à PÁGINA ATUAL. Congela a distribuição (modo
  // fixado) para o novo produto cair nesta página, e abre o diálogo de busca.
  const addProductToCurrentPage = () => {
    setConfig((prev) => {
      if (ensurePages(prev).some((p) => p.productIds !== undefined))
        return prev;
      return {
        ...prev,
        pages: ensurePages(prev).map((pg, i) =>
          pg.productIds !== undefined
            ? pg
            : { ...pg, productIds: (pageChunks[i] ?? []).map((p) => p.id) },
        ),
      };
    });
    setActiveTab("produtos");
    setPanelOpen(true);
    setAddProductSignal((s) => s + 1);
  };

  const addPage = (idx: number) => {
    updatePages((pgs) => {
      // Congela a distribuição atual: cada página existente fixa seus produtos
      // (productIds) a partir do que mostra AGORA. Assim a nova página nasce
      // vazia e nenhum produto pula da página anterior para ela.
      const frozen = pgs.map((pg, i) =>
        pg.productIds !== undefined
          ? pg
          : { ...pg, productIds: (pageChunks[i] ?? []).map((p) => p.id) },
      );
      const base = frozen[idx] ?? frozen[0];
      const nextNum = pgs.length + 1;
      const newPage: CatalogPage = {
        id: `page-${nextNum}-${pgs.length}`,
        name: `Página ${nextNum}`,
        locked: false,
        layout: base.layout,
        gridCols: base.gridCols ?? config.gridCols,
        gridRows: base.gridRows ?? config.gridRows,
        backgroundColor: base.backgroundColor,
        backgroundImage: base.backgroundImage,
        backgroundFit: base.backgroundFit,
        overlays: [],
        productIds: [],
      };
      const next = [...frozen];
      next.splice(idx + 1, 0, newPage);
      return next;
    });
    setCurrentPage(idx + 1);
  };

  const movePage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= totalPages) return;
    updatePages((pgs) => {
      const next = [...pgs];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setCurrentPage(target);
  };

  const renamePage = (idx: number, name: string) => {
    updatePages((pgs) =>
      pgs.map((pg, i) => (i === idx ? { ...pg, name } : pg)),
    );
  };

  const toggleLockPage = (idx: number) => {
    updatePages((pgs) =>
      pgs.map((pg, i) => (i === idx ? { ...pg, locked: !pg.locked } : pg)),
    );
  };

  const duplicatePage = (idx: number, mode: "full" | "background") => {
    updatePages((pgs) => {
      const src = pgs[idx] ?? pgs[0];
      const copy: CatalogPage = {
        ...src,
        id: `page-copy-${pgs.length}-${idx}`,
        name: `${src.name} (cópia)`,
        locked: false,
        overlays: mode === "full" ? src.overlays.map((o) => ({ ...o })) : [],
        texts: mode === "full" ? (src.texts ?? []).map((t) => ({ ...t })) : [],
      };
      const next = [...pgs];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setCurrentPage(idx + 1);
  };

  const deletePage = () => {
    if (totalPages <= 1 || deletePageIndex === null) return;
    const idx = deletePageIndex;
    setConfig((prev) => {
      // Congela a distribuição atual (cada página fixa seus produtos) e remove a
      // página alvo. Os produtos DELA saem do catálogo — NÃO redistribuem para as
      // outras (nem viram órfãos na última página).
      const frozen = ensurePages(prev).map((pg, i) =>
        pg.productIds !== undefined
          ? pg
          : { ...pg, productIds: (pageChunks[i] ?? []).map((p) => p.id) },
      );
      const removed = frozen[idx];
      const removedIds = [
        ...(removed?.productIds ?? []),
        ...(removed?.styleBlocks ?? [])
          .map((b) => b.productId)
          .filter((id): id is string => !!id),
      ];
      const removedSet = new Set(removedIds);
      return {
        ...prev,
        pages: frozen.filter((_, i) => i !== idx),
        manuallyAddedIds: (prev.manuallyAddedIds ?? []).filter(
          (id) => !removedSet.has(id),
        ),
        excludedProductIds: [
          ...new Set([...(prev.excludedProductIds ?? []), ...removedIds]),
        ],
      };
    });
    setCurrentPage((p) => Math.max(0, Math.min(p, totalPages - 2)));
    setDeletePageIndex(null);
  };

  // Salto pela busca de página: foca a página e rola a caixa até o topo da lista.
  // A aba "lista" esconde a coluna de páginas, então sai dela antes de rolar.
  const jumpToPage = (index: number) => {
    setActiveTab((t) => (t === "lista" ? "produtos" : t));
    setCurrentPage(index);
    requestAnimationFrame(() => {
      pageBoxRefs.current[index]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!catalogData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground">Catálogo não encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/catalogo-promocional">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-0 p-3 sm:p-4">
      {/* Header — no mobile os botões viram ícones e "Salvar" some (autosave) */}
      <div className="flex items-center gap-2 pb-3 sm:gap-3 lg:gap-4 lg:pb-4">
        {/* Retrair menu lateral (o header global fica oculto nesta rota) */}
        <SidebarTrigger className="shrink-0" />
        <div className="flex min-w-0 shrink items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="shrink-0 px-2">
            <Link href="/catalogo-promocional">
              <ArrowLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Catálogos</span>
            </Link>
          </Button>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            /
          </span>
          <span className="truncate px-1 text-sm font-semibold">
            {catalogData.name}
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            /
          </span>
        </div>
        <PageSearch
          pages={pages.map((p, i) => ({
            id: p.id ?? `page-${i}`,
            name: p.name ?? `Página ${i + 1}`,
          }))}
          onJump={jumpToPage}
          className="hidden w-64 shrink md:block"
        />
        {/* Desfazer / Refazer (estilo Canva) — `ml-auto` empurra este grupo e
            os controles seguintes (Salvar/Visualizar/Compartilhar/Tela cheia)
            de volta pro canto direito, sem a busca ocupar o espaço livre. */}
        <div className="ml-auto flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Desfazer (Ctrl+Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Refazer (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {saveStatus === "saving"
            ? "Salvando..."
            : saveStatus === "saved"
              ? "Salvo"
              : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="hidden shrink-0 lg:inline-flex"
          onClick={async () => {
            setSaveStatus("saving");
            const snapshot = config;
            const thumbnail = await captureThumbnail();
            autosave.mutate(
              {
                id: catalogId,
                config: snapshot as Record<string, unknown>,
                ...(thumbnail && { thumbnail }),
              },
              {
                onSuccess: () => {
                  savedConfigRef.current = snapshot;
                  setSaveStatus("saved");
                  toast.success("Catálogo salvo");
                },
                onError: () => setSaveStatus("idle"),
              },
            );
          }}
        >
          <Save className="h-4 w-4 mr-1" />
          Salvar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 px-2 sm:px-3"
          title="Visualizar em tela cheia"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Visualizar</span>
        </Button>
        <Button
          size="sm"
          className="shrink-0 px-2.5 sm:px-3"
          disabled={isExporting || offerExpired}
          title={
            offerExpired
              ? "Oferta vencida — compartilhamento bloqueado"
              : "Compartilhar"
          }
          onClick={() => !offerExpired && setShareOpen(true)}
        >
          <Share2 className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">
            {offerExpired
              ? "Oferta vencida"
              : isExporting
                ? "Gerando..."
                : "Compartilhar"}
          </span>
        </Button>
        {/* Tela inteira (o header global fica oculto nesta rota) */}
        <FullscreenToggle className="shrink-0" />
      </div>

      {/*
        Páginas ocultas fora da viewport — cada CatalogPreview é renderizado
        com width=1080 para que o scale interno seja 1:1, garantindo que o
        html-to-image capture o canvas no tamanho correto (1080×pageH).
      */}
      {exportMode && (
        <div
          ref={exportLayerRef}
          style={{
            position: "fixed",
            left: -9999,
            top: 0,
            width: 1080,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          {pageChunks.map((prods, i) => (
            <CatalogPreview
              key={i}
              ref={(el) => {
                allPageRefs.current[i] = el;
              }}
              config={configForPage(i)}
              products={prods}
              allProducts={products}
              supplierLogos={selectedSupplierLogos}
              dynamicContext={dynamicContexts[i]}
            />
          ))}
        </div>
      )}

      {/* Editor layout: preenche a altura restante do container (h-full do
          editor) em vez de altura fixa em 100vh — assim não sobra espaço abaixo
          quando o header/breadcrumb globais estão ocultos nesta rota. */}
      <div className="flex flex-1 min-h-0 flex-col-reverse gap-0 overflow-hidden rounded-lg border lg:flex-row">
        {/* Rail de ícones (estilo Canva) — só desktop. As abas viram ícones + há
            o botão de retrair o painel. No mobile as abas ficam horizontais
            dentro do ConfigPanel. */}
        <div className="hidden w-[68px] shrink-0 flex-col items-center gap-1.5 border-r bg-background py-3 lg:flex">
          {EDITOR_TABS.map((t) => {
            const active = activeTab === t.value && panelOpen;
            return (
              <button
                key={t.value}
                type="button"
                title={t.label}
                onClick={() => {
                  setActiveTab(t.value);
                  setPanelOpen(true);
                }}
                className={cn(
                  "flex w-[58px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <t.icon className="h-[18px] w-[18px]" />
                {t.label}
              </button>
            );
          })}
          <Button
            variant="ghost"
            size="icon"
            className="mt-auto"
            title={panelOpen ? "Retrair menu" : "Expandir menu"}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Config panel — mobile: embaixo ocupando o resto; desktop: coluna de
            360px, oculta quando o painel está retraído. */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden border-t bg-background lg:flex-none lg:border-t-0 lg:border-r",
            panelOpen ? "lg:w-[360px]" : "lg:hidden",
            activeTab === "lista" && "hidden lg:hidden",
          )}
        >
          <ConfigPanel
            config={currentConfig}
            products={products}
            pageProducts={pageProducts}
            onConfigChange={handleConfigChange}
            captureThumbnail={captureThumbnail}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            editProductRequest={editProductRequest}
            onEditProductRequest={requestEditProduct}
            addProductSignal={addProductSignal}
            onSaveCardLayout={handleSaveCardLayout}
            onApplyStyleToAllPages={applyStyleToAllPages}
            pageCount={totalPages}
            pageName={pages[safePage]?.name ?? ""}
            allPagesDynamic={allPagesDynamic}
            onAllPagesDynamic={setAllPagesDynamic}
            dynamicContext={dynamicContexts[safePage]}
          />
        </div>

        {/* Aba "Lista" — planilha/PDF → catálogo (ocupa a área central inteira). */}
        {activeTab === "lista" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <CatalogListEditor
              config={config}
              onConfigChange={handleConfigChange}
              onGenerate={generateCatalogFromList}
              onSaveCardLayout={handleSaveCardLayout}
              resolvedProducts={products}
              activeFolderFromPreview={previewFolderKey}
              onSelectFolder={(key) => {
                const idx = pages.findIndex((pg) => pg.id === key);
                if (idx >= 0) setPreviewPage(idx);
              }}
              onAddPage={() => addPage(pages.length - 1)}
              preview={
                pageChunks.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <p className="text-center text-xs text-muted-foreground">
                      Gere o catálogo para ver a prévia aqui.
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    {/* Título dinâmico (loja/cliente) + navegação por página */}
                    <div className="flex items-center gap-1 border-b bg-neutral-200/95 px-2 py-1.5 dark:bg-neutral-800/95">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        disabled={safePreview <= 0}
                        onClick={() =>
                          setPreviewPage((p) => Math.max(0, p - 1))
                        }
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="min-w-0 flex-1 text-center">
                        <p className="truncate text-xs font-semibold">
                          {previewTitle}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {safePreview + 1} / {totalPages}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        disabled={safePreview >= totalPages - 1}
                        onClick={() =>
                          setPreviewPage((p) => Math.min(totalPages - 1, p + 1))
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-2">
                      {/* Clicar na prévia abre EXATAMENTE a página da loja/cliente
                          correspondente no editor (sai da aba "lista" e rola até ela). */}
                      {/* biome-ignore lint/a11y/useSemanticElements: a prévia tem blocos; um <button> aninharia conteúdo inválido */}
                      <div
                        role="button"
                        tabIndex={0}
                        title={`Abrir a página de ${previewTitle}`}
                        className="w-full cursor-pointer rounded-sm shadow-sm outline-none ring-primary/60 transition hover:ring-2 focus-visible:ring-2"
                        onClick={() => jumpToPage(safePreview)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            jumpToPage(safePreview);
                          }
                        }}
                      >
                        <CatalogPreview
                          config={configForPage(safePreview)}
                          products={pageChunks[safePreview] ?? []}
                          allProducts={products}
                          supplierLogos={selectedSupplierLogos}
                          dynamicContext={dynamicContexts[safePreview]}
                        />
                      </div>
                    </div>
                  </div>
                )
              }
            />
          </div>
        )}

        {/* Preview — desktop: preenche à direita; mobile: no topo, altura fixa
            (~42vh) e sempre visível pra ver as mudanças ao vivo. */}
        <div
          className={cn(
            "flex h-[42vh] shrink-0 flex-col overflow-hidden lg:h-auto lg:flex-1",
            activeTab === "lista" && "hidden",
          )}
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto bg-neutral-300 dark:bg-neutral-800 p-3 sm:p-6"
          >
            {/* Páginas empilhadas verticalmente (estilo Canva): rola para baixo
                entre as páginas de ofertas. Cada página tem sua própria alça e
                camada de edição. */}
            <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8">
              {pageChunks.map((prods, i) => {
                const cfg = configForPage(i);
                const pageExpired = isOfferExpired(cfg);
                const locked = pages[i]?.locked ?? false;
                if (!pageRefs.current[i]) {
                  pageRefs.current[i] = { current: null };
                }
                const pageRef = pageRefs.current[i];
                // Virtualização: só renderiza o preview completo das páginas
                // perto da atual (+ a página 0, base da miniatura). As demais
                // viram um placeholder com a mesma altura — evita manter dezenas
                // de previews (e centenas de imagens) na memória.
                const renderFull = i === 0 || Math.abs(i - currentPage) <= 1;
                return (
                  <div
                    key={pages[i]?.id ?? i}
                    ref={(el) => {
                      pageBoxRefs.current[i] = el;
                    }}
                    data-page-index={i}
                    className="flex flex-col gap-2"
                    onPointerDownCapture={() => setCurrentPage(i)}
                  >
                    <PageToolbar
                      pageName={pages[i]?.name ?? `Página ${i + 1}`}
                      pageIndex={i}
                      totalPages={totalPages}
                      locked={locked}
                      productCount={prods.length}
                      layout={cfg.layout}
                      gridCols={cfg.gridCols}
                      gridRows={cfg.gridRows}
                      onLayoutChange={(layout) =>
                        handlePageConfigChange(i, { layout })
                      }
                      onGridColsChange={(gridCols) =>
                        handlePageConfigChange(i, { gridCols })
                      }
                      onGridRowsChange={(gridRows) =>
                        handlePageConfigChange(i, { gridRows })
                      }
                      onRename={(name) => renamePage(i, name)}
                      onMovePrev={() => movePage(i, -1)}
                      onMoveNext={() => movePage(i, 1)}
                      onAddPage={() => addPage(i)}
                      onToggleLock={() => toggleLockPage(i)}
                      onDuplicate={(mode) => duplicatePage(i, mode)}
                      onDelete={() => setDeletePageIndex(i)}
                    />
                    <div className="relative w-full">
                      {renderFull ? (
                        <>
                          <CatalogPreview
                            ref={(el) => {
                              pageRef.current = el;
                              if (i === 0) previewRef.current = el;
                            }}
                            config={cfg}
                            products={prods}
                            allProducts={products}
                            supplierLogos={selectedSupplierLogos}
                            dynamicContext={dynamicContexts[i]}
                          />
                          {!locked && (
                            <SelectionLayer
                              previewRef={pageRef}
                              productIds={prods.map((p) => p.id)}
                              layoutIsFeatured={cfg.layout === "featured"}
                              overlays={cfg.overlays ?? []}
                              texts={cfg.texts ?? []}
                              selection={currentPage === i ? selection : null}
                              onSelectionChange={(next) => {
                                setCurrentPage(i);
                                handleSelectionChange(next);
                              }}
                              onEditProduct={(productId, opts) => {
                                setCurrentPage(i);
                                requestEditProduct(productId, opts);
                              }}
                              cardLayoutFor={(pid) =>
                                effectiveCardLayout(config, pid)
                              }
                              onOverlaysChange={(overlays) =>
                                handlePageConfigChange(i, { overlays })
                              }
                              onTextsChange={(texts) =>
                                handlePageConfigChange(i, { texts })
                              }
                              styleBlocks={cfg.styleBlocks ?? []}
                              onStyleBlocksChange={(styleBlocks) =>
                                handlePageConfigChange(i, { styleBlocks })
                              }
                              productGroup={cfg.productGroup ?? null}
                              onGroupChange={(productGroup, opts) =>
                                handlePageConfigChange(i, {
                                  productGroup,
                                  ...(opts?.grid ?? {}),
                                  ...(opts?.scale != null
                                    ? { productGroupScale: opts.scale }
                                    : {}),
                                })
                              }
                              productGroups={cfg.productGroups ?? []}
                              onGroupsChange={(productGroups) =>
                                handlePageConfigChange(i, { productGroups })
                              }
                              onGroupDuplicate={(source, sourceId) => {
                                // Grupo único: colunas efetivas vêm do layout;
                                // multi: vêm do próprio grupo (source).
                                const cols =
                                  cfg.layout === "grid-2"
                                    ? 2
                                    : cfg.layout === "grid-4"
                                      ? 4
                                      : cfg.layout === "custom"
                                        ? (cfg.gridCols ?? 3)
                                        : 3;
                                const rows = cfg.gridRows ?? 4;
                                handleGroupDuplicate(i, {
                                  rect: source.rect,
                                  gridCols: sourceId ? source.gridCols : cols,
                                  gridRows: sourceId ? source.gridRows : rows,
                                });
                              }}
                              onGroupDelete={(groupId) =>
                                setDeleteGroup({ pageIndex: i, groupId })
                              }
                              layoutIsCustom={cfg.layout === "custom"}
                              gridCols={cfg.gridCols ?? 3}
                              gridRows={cfg.gridRows ?? 4}
                              groupScale={cfg.productGroupScale ?? 1}
                              pageH={pageHeightOf(cfg)}
                            />
                          )}
                          {pageExpired && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-lg bg-black/70 text-center backdrop-blur-sm">
                              <span className="text-2xl font-bold text-white sm:text-3xl">
                                Oferta vencida
                              </span>
                              <span className="text-xs text-white/80">
                                Some do link público
                              </span>
                            </div>
                          )}
                          {prods.length === 0 && !pageExpired && (
                            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center">
                              {/* Silhueta de um card de produto (placeholder cinza) */}
                              <div className="flex h-40 w-32 flex-col gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-2">
                                <div className="flex flex-1 items-center justify-center rounded bg-muted-foreground/10">
                                  <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                                </div>
                                <div className="h-2 w-4/5 rounded bg-muted-foreground/20" />
                                <div className="h-2 w-1/2 rounded bg-muted-foreground/20" />
                              </div>
                              <p className="text-sm font-medium text-foreground/80">
                                Página vazia — comece adicionando um produto
                              </p>
                              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setCurrentPage(i);
                                    setActiveTab("produtos");
                                    setPanelOpen(true);
                                    // Abre o diálogo de busca de produtos direto.
                                    setAddProductSignal((s) => s + 1);
                                  }}
                                >
                                  <Plus className="mr-1 h-4 w-4" />
                                  Adicionar produto
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCurrentPage(i);
                                    setActiveTab("layout");
                                    setPanelOpen(true);
                                  }}
                                >
                                  <ImageIcon className="mr-1 h-4 w-4" />
                                  Adicionar fundo
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className="flex w-full items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground"
                          style={{
                            aspectRatio: `${PAGE_W} / ${pageHeightOf(cfg)}`,
                          }}
                        >
                          {pages[i]?.name ?? `Página ${i + 1}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FAB "+" — adicionar produto à página atual (fixo, canto inferior direito) */}
      <button
        type="button"
        title="Adicionar produto à página atual"
        aria-label="Adicionar produto à página atual"
        onClick={addProductToCurrentPage}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-7 w-7" />
      </button>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        catalogId={catalogId}
        catalogName={catalogData.name}
        totalPages={totalPages}
        pageNames={pages.map((p, i) => p.name ?? `Página ${i + 1}`)}
        initialPage={safePage}
        onExportPng={exportAsPng}
        onExportPdf={exportAsPdf}
        onExportPagePng={exportPageAsPng}
        onExportPagePdf={exportPageAsPdf}
        onPrintPage={printPage}
        capturePage={capturePage}
      />

      {/* Visualizar: preview em tela cheia, tamanho real, sem painéis. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[95vh] w-[95vw] max-w-[95vw] flex-col gap-3 p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center justify-between gap-3 pr-8">
              <span className="truncate">{catalogData.name}</span>
              {totalPages > 1 && (
                <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  Página {currentPage + 1} de {totalPages}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded bg-neutral-300 dark:bg-neutral-800 p-4">
            <div
              style={{
                width: `min(88vw, calc((95vh - 140px) * ${PAGE_W / pageHeightOf(config)}))`,
              }}
            >
              <CatalogPreview
                config={currentConfig}
                products={pageChunks[safePage] ?? []}
                allProducts={products}
                supplierLogos={selectedSupplierLogos}
                dynamicContext={dynamicContexts[safePage]}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletePageIndex !== null}
        onOpenChange={(o) => !o && setDeletePageIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir página?</DialogTitle>
            <DialogDescription>
              A página &quot;
              {deletePageIndex !== null ? pages[deletePageIndex]?.name : ""}
              &quot;, seus produtos e etiquetas serão removidos. As demais
              páginas mantêm seus produtos (nada é redistribuído).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePageIndex(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deletePage}>
              Excluir página
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteGroup !== null}
        onOpenChange={(o) => !o && setDeleteGroup(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir grupo de produtos?</DialogTitle>
            <DialogDescription>
              {deleteGroup?.groupId
                ? "O grupo e os produtos dele serão removidos desta página. Os demais produtos da página permanecem."
                : "Os produtos desta página serão removidos (a grade fica vazia). As demais páginas não são afetadas."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroup(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteGroup}>
              Excluir grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
