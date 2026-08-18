"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigPanel } from "./components/config-panel";
import { CatalogPreview } from "./components/catalog-preview";
import {
  usePromotionalCatalog,
  useUpdateCatalog,
  usePromotionalProducts,
} from "./hooks/use-catalog";
import { useExport } from "./hooks/use-export";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import type { CatalogConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";

const PAGE_W = 1080;
const PAGE_H_VALUES: Record<CatalogConfig["pageSize"], number> = { square: 1080, story: 1920 };
// Espaço fixo do cabeçalho: h2 text-2xl (~36px) + mb-6 (24px) + subtitle (~20px)
const HEADER_H = 80;
// Margem de segurança: impede que a última linha corte o rodapé do canvas.
const BOTTOM_BUFFER = 32;
const GAP4 = 16; // gap-4 (Tailwind)
const GAP3 = 12; // gap-3

// Altura em px de cada opção de textSize (base para estimativa de line-height).
const TEXT_SIZE_PX: Record<CatalogConfig["textSize"], number> = {
  xs: 12, sm: 16, base: 22, lg: 30, xl: 40, "2xl": 52, "3xl": 64, "4xl": 80,
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
      if (config.showStock)    h += lineH;
      return h;
    }
    case "minimal":
      // aspect-square + p-2*2(16) + nome(1 linha) + preço(1 linha)
      return cardWidth + 16 + lineH * 2 + 8;
    default: { // standard, countdown, badge-hot
      // p-3*2(24) + nome(2 linhas) + preço(1 linha)
      let contentH = 24 + lineH * 2 + lineH;
      if (config.showCategory)    contentH += lineH;
      if (config.showSku)         contentH += lineH;
      if (config.showDescription) contentH += lineH * 2; // line-clamp-2
      if (config.showStock)       contentH += lineH;
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
  const availH = Math.max(0, pageH - config.paddingTop - config.paddingBottom - HEADER_H - BOTTOM_BUFFER);
  const availW = Math.max(1, PAGE_W - config.paddingLeft - config.paddingRight);

  const gridItems = (cols: number, gap: number) => {
    const cardW = (availW - (cols - 1) * gap) / cols;
    const cardH = estimateCardHeight(config.cardStyle, cardW, config);
    const rows = Math.floor(availH / (cardH + gap));
    return Math.max(cols, rows * cols);
  };

  switch (layout) {
    case "grid-2":  return gridItems(2, GAP4);
    case "grid-3":  return gridItems(3, GAP4);
    case "grid-4":  return gridItems(4, GAP3);
    case "masonry": return gridItems(3, GAP4);
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

export function CatalogEditor({ catalogId }: CatalogEditorProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const allPageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: catalogData, isLoading } = usePromotionalCatalog(catalogId);
  const updateMutation = useUpdateCatalog();

  const [config, setConfig] = useState<CatalogConfig>(DEFAULT_CONFIG);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (catalogData?.config) {
      setConfig({ ...DEFAULT_CONFIG, ...(catalogData.config as Partial<CatalogConfig>) });
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
    let list = rawProducts.filter((p) => !excluded.has(p.id));

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

    return list;
  }, [rawProducts, config.excludedProductIds, config.sortBy]);

  // Paginação — quantos itens cabem por página (calculado proporcionalmente)
  const itemsPerPage = useMemo(
    () => getItemsPerPage(config.layout, config.pageSize, config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config.layout, config.pageSize, config.cardStyle, config.textSize,
      config.paddingTop, config.paddingRight, config.paddingBottom, config.paddingLeft,
      config.showDescription, config.showCategory, config.showStock, config.showSku,
    ],
  );

  const selectedSupplierLogos = useMemo(() => {
    const ids = new Set(config.footerSupplierIds ?? []);
    return suppliers
      .filter((s) => ids.has(s.id) && s.logo)
      .map((s) => ({ id: s.id, name: s.tradeName || s.name, logo: s.logo! }));
  }, [suppliers, config.footerSupplierIds]);

  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));

  const pageProducts = useMemo(
    () => products.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage),
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

  // Auto-save with debounce
  useEffect(() => {
    if (!catalogData) return;
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      updateMutation.mutate(
        { id: catalogId, config: config as Record<string, unknown> },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("idle"),
        },
      );
    }, 800);
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
    <div className="flex flex-col gap-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/catalogo-promocional">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Catálogos
            </Link>
          </Button>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="font-semibold text-sm truncate px-1">{catalogData.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {saveStatus === "saving" ? "Salvando..." : saveStatus === "saved" ? "Salvo" : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateMutation.mutate({ id: catalogId, config: config as Record<string, unknown> })
          }
        >
          <Save className="h-4 w-4 mr-1" />
          Salvar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              {isExporting ? "Gerando..." : "↓ Exportar"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportAsPng}>
              Baixar página atual (PNG)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportAsPdf}>
              Baixar todas as páginas (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/*
        Páginas ocultas fora da viewport — cada CatalogPreview é renderizado
        com width=1080 para que o scale interno seja 1:1, garantindo que o
        html-to-image capture o canvas no tamanho correto (1080×pageH).
      */}
      <div
        style={{ position: "fixed", left: -9999, top: 0, width: 1080, pointerEvents: "none" }}
        aria-hidden
      >
        {pageChunks.map((prods, i) => (
          <CatalogPreview
            key={i}
            ref={(el) => { allPageRefs.current[i] = el; }}
            config={config}
            products={prods}
            supplierLogos={selectedSupplierLogos}
          />
        ))}
      </div>

      {/* Editor layout */}
      <div className="flex gap-0 border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        {/* Config panel */}
        <div className="w-72 shrink-0 border-r bg-background overflow-hidden flex flex-col">
          <ConfigPanel
            config={config}
            products={products}
            onConfigChange={handleConfigChange}
          />
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
          <div className="flex-1 overflow-auto bg-muted/30 p-6">
            <CatalogPreview ref={previewRef} config={config} products={pageProducts} supplierLogos={selectedSupplierLogos} />
          </div>
        </div>
      </div>
    </div>
  );
}
