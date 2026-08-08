import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3X3Icon, ListIcon, Search } from "lucide-react";
import type { ProductSale } from ".";
import { currencyFormatter } from "@/utils/currency-formatter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
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
}: ProductSessionProps) {
  const previousIsDisabled = !hasPreviousPage;
  const nextIsDisabled = !hasNextPage;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              {/* No PDV a busca fica sempre pronta para digitar (nome/SKU/código). */}
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="Buscar por nome, SKU ou código de barras..."
                className="h-12 rounded-lg pl-12 text-base"
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
        <CardContent>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {isLoading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="h-44 w-full rounded-xl" />
                  ))
                : products.map((product, index) => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() =>
                        Number(product.currentStock) > 0 && addToCart(product)
                      }
                      disabled={Number(product.currentStock) === 0}
                      className={cn(
                        "group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
                        index === selectedIndex &&
                          "border-primary ring-2 ring-primary",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="rounded-md bg-muted px-2 py-1 text-sm font-bold">
                          {currencyFormatter(product.salePrice)}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {Number(product.currentStock) > 0
                            ? `${product.currentStock} un`
                            : "0"}
                        </span>
                      </div>
                      <div className="flex h-24 items-center justify-center">
                        {product.image ? (
                          // biome-ignore lint/performance/noImgElement: foto do produto via URL do S3
                          <img
                            src={product.image}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Avatar className="h-16 w-16 rounded-md">
                            <AvatarFallback>
                              {product.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="line-clamp-2 text-sm font-bold uppercase leading-tight">
                        {product.name}
                      </div>
                      {/* Acento de cor fininho na base (identidade do tile). */}
                      <span
                        className={cn(
                          "absolute inset-x-0 bottom-0 h-1",
                          tileColor(product.id),
                        )}
                      />
                    </button>
                  ))}
            </div>
          ) : (
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))
                : products.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() =>
                        product.currentStock > 0 && addToCart(product)
                      }
                      disabled={product.currentStock === 0}
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
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.sku} | {product.barcode}
                        </div>
                      </div>
                      <Badge
                        variant={
                          product.currentStock > 0 ? "secondary" : "destructive"
                        }
                      >
                        {product.currentStock > 0
                          ? `${product.currentStock} un`
                          : "Sem estoque"}
                      </Badge>
                      <div className="font-semibold text-primary">
                        {currencyFormatter(product.salePrice)}
                      </div>
                    </button>
                  ))}
            </div>
          )}

          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant={"secondary"}
                  disabled={previousIsDisabled}
                  onClick={onPreviousPage}
                >
                  Anterior
                </Button>
              </PaginationItem>
              <Button variant={"secondary"} disabled>
                {pageIndex ?? 1}
              </Button>
              <PaginationItem>
                <Button
                  variant={"secondary"}
                  disabled={nextIsDisabled}
                  onClick={onNextPage}
                >
                  Próximo
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          {/* Abas de categoria (como na referência): filtram a grade. */}
          {categories.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto border-t pt-3">
              <Button
                type="button"
                size="sm"
                variant={selectedCategory === null ? "default" : "outline"}
                className="shrink-0"
                onClick={() => onSelectCategory?.(null)}
              >
                Todos
              </Button>
              {categories.map((category) => (
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
