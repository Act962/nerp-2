import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3X3Icon, ListIcon, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ProductSale } from ".";
import { currencyFormatter } from "@/utils/currency-formatter";
import { unitLabel } from "@/features/products/lib/units";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

// Cor determinística por produto (para os tiles coloridos sem foto).
const TILE_COLORS = [
  "bg-blue-600",
  "bg-orange-500",
  "bg-purple-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-amber-500",
  "bg-sky-600",
  "bg-fuchsia-600",
  "bg-cyan-600",
  "bg-lime-600",
];

function tileColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TILE_COLORS[hash % TILE_COLORS.length];
}

interface Category {
  id: string;
  name: string;
}

interface ProductSessionProps {
  products: ProductSale[];
  addToCart: (product: ProductSale) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** Índice do produto destacado na grade (navegação por seta). */
  selectedIndex?: number | null;
  /** Setas na busca movem a seleção na grade. */
  onArrow?: (dir: "next" | "prev") => void;
  /** Enter na busca (adiciona selecionado / scan / F2 — decidido no pai). */
  onEnter?: () => void;
  categories?: Category[];
  selectedCategory?: string | null;
  onSelectCategory?: (id: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  pageIndex?: number;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  isLoading?: boolean;
  /** Rótulo do atalho da busca (ex.: "Alt+B") — mostrado sutil dentro do input. */
  searchShortcut?: string;
  /** Logo da org — usada como watermark (cinza + opacidade) nos tiles sem foto. */
  orgLogo?: string | null;
}

export function ProductSection({
  products,
  addToCart,
  searchInputRef,
  searchTerm,
  setSearchTerm,
  selectedIndex = null,
  onArrow,
  onEnter,
  categories = [],
  selectedCategory = null,
  onSelectCategory,
  viewMode,
  setViewMode,
  hasNextPage,
  hasPreviousPage,
  pageIndex,
  onNextPage,
  onPreviousPage,
  isLoading,
  searchShortcut,
  orgLogo,
}: ProductSessionProps) {
  const previousIsDisabled = !hasPreviousPage;
  const nextIsDisabled = !hasNextPage;

  return (
    // Altura total: busca fica no topo, categorias/paginação no rodapé,
    // a GRADE de produtos rola internamente (não a página).
    <div className="flex h-full min-h-0 min-w-0 flex-col space-y-4">
      <Card className="flex h-full min-h-0 flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500" />
              {/* No PDV a busca fica sempre pronta para digitar (nome/SKU/código).
                  Fundo branco + texto preto (mesma paleta dos tiles), altura 35%
                  maior (h-12 → h-16) e fonte grande (text-xl) alinhando com o
                  preço em destaque do tile. */}
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="Buscar por nome, SKU ou código de barras..."
                className="h-16 rounded-lg border-slate-200 bg-white pl-12 pr-16 text-xl text-slate-900 placeholder:text-slate-500 dark:bg-white md:text-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onEnter?.();
                  } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                    e.preventDefault();
                    onArrow?.("next");
                  } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    onArrow?.("prev");
                  }
                }}
              />
              {/* Atalho pra focar essa busca — sutil, sobre o fundo branco
                  do input (paleta slate pra combinar). */}
              {searchShortcut && (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-normal text-slate-500">
                  {searchShortcut}
                </kbd>
              )}
            </div>
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList className="h-9">
                <TabsTrigger value="grid" className="px-2">
                  <Grid3X3Icon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-2">
                  <ListIcon className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {/* GRADE de produtos rola aqui dentro — categorias/paginação
              ficam ancoradas no rodapé do card, sempre visíveis. */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {viewMode === "grid" ? (
            <div className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3">
              {isLoading
                ? Array.from({ length: 9 }).map((_, index) => (
                    <Skeleton key={index} className="w-full rounded-xl" />
                  ))
                : products.map((product, index) => {
                    // Produto sem controle de estoque (`trackStock=false`)
                    // vende ilimitado — ex.: serviços. Nesse caso não bloqueia
                    // pelo `currentStock`.
                    const outOfStock =
                      product.trackStock && Number(product.currentStock) <= 0;
                    return (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product)}
                      disabled={outOfStock}
                      className={cn(
                        // Card 100% branco (independente do tema do resto do
                        // sistema) com texto preto — padrão de tiles de
                        // produto de e-commerce. Alvo: 3×2 na primeira vista.
                        "group relative flex flex-col overflow-hidden rounded-xl border bg-white p-3 text-left text-slate-900 shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
                        index === selectedIndex &&
                          "border-primary ring-2 ring-primary",
                      )}
                    >
                      {/* SKU sutil no canto — onde antes ficava o badge de
                          estoque. Estoque vira implícito (zerado = disabled). */}
                      {product.sku && (
                        <span className="absolute right-3 top-2.5 z-10 max-w-[60%] truncate text-xs font-medium text-slate-500">
                          {product.sku}
                        </span>
                      )}
                      {/* Foto ocupa TODO o espaço vertical restante do tile —
                          quanto maior o grade, maior a foto. */}
                      <div className="flex min-h-0 flex-1 items-center justify-center">
                        {product.image ? (
                          // biome-ignore lint/performance/noImgElement: foto do produto via URL do S3
                          <img
                            src={product.image}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : orgLogo ? (
                          // Fallback sem foto do produto: logo da org em
                          // grayscale + opacidade bem baixa como watermark.
                          // biome-ignore lint/performance/noImgElement: logo via URL do S3
                          <img
                            src={orgLogo}
                            alt=""
                            className="h-full w-full object-contain opacity-20 grayscale"
                          />
                        ) : (
                          <Avatar className="h-24 w-24 rounded-md opacity-40 grayscale">
                            <AvatarFallback>
                              {product.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm font-semibold uppercase leading-tight text-slate-900">
                        {product.name}
                      </div>
                      {/* Preço + unidade lado a lado, ambos sutis. */}
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-base font-bold tabular-nums text-slate-900">
                          R$ {currencyFormatter(product.salePrice)}
                        </span>
                        <span className="text-xs font-normal text-slate-500">
                          / {unitLabel(product.unit)}
                        </span>
                      </div>
                    </button>
                    );
                  })}
            </div>
          ) : (
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 16 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))
                : products.map((product) => {
                    const outOfStock =
                      product.trackStock && product.currentStock <= 0;
                    return (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product)}
                      disabled={outOfStock}
                      className="w-full flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Avatar className="h-12 w-12 rounded-md">
                        <AvatarImage
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                        />
                        <AvatarFallback>
                          {product.name.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <div className="text-[15px] font-medium">
                          {product.name}
                        </div>
                        <div className="text-[13px] text-muted-foreground">
                          {product.sku} | {product.barcode}
                        </div>
                      </div>
                      <Badge
                        variant={
                          !product.trackStock
                            ? "outline"
                            : product.currentStock > 0
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {!product.trackStock
                          ? "Sem controle"
                          : product.currentStock > 0
                            ? `${product.currentStock} ${unitLabel(product.unit)}`
                            : "Sem estoque"}
                      </Badge>
                      <div className="font-semibold text-primary">
                        {currencyFormatter(product.salePrice)}
                      </div>
                    </button>
                    );
                  })}
            </div>
          )}
          </div>

          {/* Abas de categoria (como na referência): filtram a grade.
              Em uma linha só, sem scroll: o que não couber vira "+N" que
              abre um popover com o restante — evita empurrar a coluna do
              carrinho e não estica a página em altura. */}
          {categories.length > 0 && (
            <CategoryTabs
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Uma linha de filtros de categoria com overflow "measured": mede o container
// depois do render, esconde os botões que não coubessem e mostra "+N" que
// abre um popover com o restante. Sem scroll horizontal, sem quebra de linha.
function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: Category[];
  selectedCategory: string | null | undefined;
  onSelectCategory: ((id: string | null) => void) | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(categories.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function recompute() {
      if (!container || !measure) return;
      const items = Array.from(measure.children) as HTMLElement[];
      // último item é o botão "+N" (só existe para medir a largura reservada)
      const overflowBtn = items[items.length - 1];
      const categoryItems = items.slice(1, -1); // pula "Todos" + "+N"
      const overflowWidth = overflowBtn?.offsetWidth ?? 0;
      const todosWidth = items[0]?.offsetWidth ?? 0;
      const gap = 8; // gap-2 = 0.5rem

      const available = container.clientWidth;
      let used = todosWidth;
      let count = 0;

      for (let i = 0; i < categoryItems.length; i++) {
        const item = categoryItems[i];
        const w = item.offsetWidth;
        const isLast = i === categoryItems.length - 1;
        // reserva espaço pro botão "+N" se ainda vão sobrar categorias
        const reserve = isLast ? 0 : overflowWidth + gap;
        const next = used + gap + w + reserve;
        if (next <= available) {
          used = used + gap + w;
          count = i + 1;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [categories]);

  const hidden = categories.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      className="mt-2 flex items-center gap-2 overflow-hidden border-t pt-2"
    >
      <Button
        type="button"
        size="sm"
        variant={selectedCategory === null ? "default" : "outline"}
        className="shrink-0"
        onClick={() => onSelectCategory?.(null)}
      >
        Todos
      </Button>
      {categories.slice(0, visibleCount).map((category) => (
        <Button
          key={category.id}
          type="button"
          size="sm"
          variant={
            selectedCategory === category.id ? "default" : "outline"
          }
          className="shrink-0"
          onClick={() => onSelectCategory?.(category.id)}
        >
          {category.name}
        </Button>
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={
                hidden.some((c) => c.id === selectedCategory)
                  ? "default"
                  : "outline"
              }
              className="shrink-0"
            >
              +{hidden.length}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-72 w-56 overflow-y-auto p-1">
            <div className="flex flex-col">
              {hidden.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    "flex items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selectedCategory === category.id &&
                      "bg-accent font-medium",
                  )}
                  onClick={() => onSelectCategory?.(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Réplica invisível usada só pra medir a largura real dos botões. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute -left-full flex items-center gap-2"
      >
        <Button type="button" size="sm" variant="outline" className="shrink-0">
          Todos
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
          >
            {category.name}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="shrink-0">
          +{categories.length}
        </Button>
      </div>
    </div>
  );
}
