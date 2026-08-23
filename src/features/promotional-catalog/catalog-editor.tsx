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
  Palette,
  Sticker,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigPanel } from "./components/config-panel";
import { CatalogPreview } from "./components/catalog-preview";
import { OverlayEditor } from "./components/overlay-editor";
import { ShareDialog } from "./components/share-dialog";
import {
  usePromotionalCatalog,
  useAutosaveCatalog,
  usePromotionalProducts,
} from "./hooks/use-catalog";
import { toast } from "sonner";
import { useExport } from "./hooks/use-export";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import type { CatalogConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";

const PAGE_W = 1080;
const PAGE_H_VALUES: Record<CatalogConfig["pageSize"], number> = {
  square: 1080,
  story: 1920,
  portrait: 1440,
};
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
  { value: "produtos", label: "Produtos", icon: Package },
  { value: "layout", label: "Layout", icon: LayoutTemplate },
  { value: "padroes", label: "Padrões", icon: Palette },
  { value: "etiqueta", label: "Etiqueta", icon: Sticker },
] as const;

export function CatalogEditor({ catalogId }: CatalogEditorProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const allPageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: catalogData, isLoading } = usePromotionalCatalog(catalogId);
  const autosave = useAutosaveCatalog();

  // Aba ativa (rail) + painel de config aberto/retraído (só no desktop).
  const [activeTab, setActiveTab] = useState<string>("produtos");
  const [panelOpen, setPanelOpen] = useState(true);

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
      const loaded = {
        ...DEFAULT_CONFIG,
        ...(catalogData.config as Partial<CatalogConfig>),
      };
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
  });

  const products = useMemo(() => {
    const excluded = new Set(config.excludedProductIds);
    const overrides = config.priceOverrides ?? {};
    let list = rawProducts
      .filter((p) => !excluded.has(p.id))
      .map((p) => {
        // Preço normal sobrescrito SÓ para este catálogo — recalcula
        // desconto/economia a partir dele. `basePrice` guarda o do cadastro.
        const override = overrides[p.id];
        if (typeof override !== "number" || override <= 0) {
          return { ...p, basePrice: p.salePrice };
        }
        const salePrice = override;
        const promotionalPrice = p.promotionalPrice;
        const discount =
          promotionalPrice != null && salePrice > 0
            ? ((salePrice - promotionalPrice) / salePrice) * 100
            : null;
        const savings =
          promotionalPrice != null ? salePrice - promotionalPrice : null;
        return { ...p, salePrice, discount, savings, basePrice: p.salePrice };
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

    // Ordem manual (arrastar ↑/↓ na lista) tem prioridade sobre `sortBy`:
    // os ids listados vêm primeiro, o resto segue a ordenação automática.
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
  }, [
    rawProducts,
    config.excludedProductIds,
    config.sortBy,
    config.priceOverrides,
    config.productOrder,
  ]);

  // Paginação — quantos itens cabem por página (calculado proporcionalmente)
  const itemsPerPage = useMemo(
    () => getItemsPerPage(config.layout, config.pageSize, config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config.layout,
      config.pageSize,
      config.cardStyle,
      config.textSize,
      config.paddingTop,
      config.paddingRight,
      config.paddingBottom,
      config.paddingLeft,
      config.showDescription,
      config.showCategory,
      config.showStock,
      config.showSku,
    ],
  );

  const selectedSupplierLogos = useMemo(() => {
    const ids = new Set(config.footerSupplierIds ?? []);
    return suppliers
      .filter((s) => ids.has(s.id) && s.logo)
      .map((s) => ({ id: s.id, name: s.tradeName || s.name, logo: s.logo! }));
  }, [suppliers, config.footerSupplierIds]);

  const [currentPage, setCurrentPage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );

  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));

  const pageProducts = useMemo(
    () =>
      products.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage,
      ),
    [products, currentPage, itemsPerPage],
  );

  // Volta à pag. 0 quando o nº de itens por página muda (troca de layout/formato)
  useEffect(() => {
    setCurrentPage(0);
  }, [itemsPerPage]);

  // Todos os chunks de produtos (para renderização oculta + export PDF multi-página)
  const pageChunks = useMemo(
    () =>
      Array.from({ length: totalPages }, (_, i) =>
        products.slice(i * itemsPerPage, (i + 1) * itemsPerPage),
      ),
    [products, totalPages, itemsPerPage],
  );

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

  // PNG da página atual em resolução cheia (1080px) — para copiar/compartilhar.
  const capturePng = async (): Promise<string> => {
    const el = previewRef.current;
    if (!el) return "";
    try {
      const { toPng } = await import("html-to-image");
      return await toPng(el, {
        pixelRatio: 1,
        skipFonts: true,
        cacheBust: false,
      });
    } catch {
      return "";
    }
  };

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

  const { exportAsPng, exportAsPdf, isExporting } = useExport({
    previewRef,
    allPageRefs,
    totalPages,
    catalogName: catalogData?.name ?? "catalogo",
    pageSize: config.pageSize,
  });

  const handleConfigChange = (changes: Partial<CatalogConfig>) => {
    setConfig((prev) => ({ ...prev, ...changes }));
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
        <div className="flex min-w-0 flex-1 items-center gap-1">
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
          disabled={isExporting}
          title="Compartilhar"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">
            {isExporting ? "Gerando..." : "Compartilhar"}
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
      <div
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
            config={config}
            products={prods}
            supplierLogos={selectedSupplierLogos}
          />
        ))}
      </div>

      {/* Editor layout: preenche a altura restante do container (h-full do
          editor) em vez de altura fixa em 100vh — assim não sobra espaço abaixo
          quando o header/breadcrumb globais estão ocultos nesta rota. */}
      <div className="flex flex-1 min-h-0 flex-col-reverse gap-0 overflow-hidden rounded-lg border lg:flex-row">
        {/* Rail de ícones (estilo Canva) — só desktop. As abas viram ícones + há
            o botão de retrair o painel. No mobile as abas ficam horizontais
            dentro do ConfigPanel. */}
        <div className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r bg-background py-2 lg:flex">
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
                  "flex w-14 flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <t.icon className="h-5 w-5" />
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
          )}
        >
          <ConfigPanel
            config={config}
            products={products}
            itemsPerPage={itemsPerPage}
            onConfigChange={handleConfigChange}
            captureThumbnail={captureThumbnail}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
          />
        </div>

        {/* Preview — desktop: preenche à direita; mobile: no topo, altura fixa
            (~42vh) e sempre visível pra ver as mudanças ao vivo. */}
        <div className="flex h-[42vh] shrink-0 flex-col overflow-hidden lg:h-auto lg:flex-1">
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-background shrink-0">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
                <span className="ml-2 opacity-60">
                  ({products.length} produto{products.length !== 1 ? "s" : ""})
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex-1 overflow-auto bg-neutral-300 dark:bg-neutral-800 p-3 sm:p-6">
            {/* Canvas sempre centralizado (estilo Canva), com largura máxima. */}
            <div className="relative mx-auto w-full max-w-[680px]">
              <CatalogPreview
                ref={previewRef}
                config={config}
                products={pageProducts}
                supplierLogos={selectedSupplierLogos}
              />
              <OverlayEditor
                overlays={config.overlays ?? []}
                selectedId={selectedOverlayId}
                onSelect={setSelectedOverlayId}
                onChange={(overlays) => handleConfigChange({ overlays })}
              />
            </div>
          </div>
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        catalogName={catalogData.name}
        totalPages={totalPages}
        onExportPng={exportAsPng}
        onExportPdf={exportAsPdf}
        capturePng={capturePng}
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
                width: `min(88vw, calc((95vh - 140px) * ${PAGE_W / PAGE_H_VALUES[config.pageSize]}))`,
              }}
            >
              <CatalogPreview
                config={config}
                products={pageProducts}
                supplierLogos={selectedSupplierLogos}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
