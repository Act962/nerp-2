"use client";

import { useState, useDeferredValue, useEffect } from "react";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { constructUrl } from "@/hooks/use-construct-url";
import { ImageIcon } from "lucide-react";
import { useUpdateProductPrice } from "../hooks/use-catalog";
import type { CatalogConfig } from "../types";

// Página pequena: nunca despeja a lista inteira de produtos no diálogo.
const PAGE_SIZE = 8;

interface AddProductDialogProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
  // Modo "vincular": além de adicionar o produto ao catálogo, devolve o id
  // escolhido (ex.: para ligar a um bloco de estilo) e fecha o diálogo.
  onPicked?: (id: string) => void;
  triggerLabel?: string;
  // Classe do botão-gatilho (para alinhar com outros botões, ex.: lado a lado).
  triggerClassName?: string;
  title?: string;
  // Abertura controlada (opcional) — permite abrir o diálogo de fora (ex.: botão
  // "Adicionar produto" do estado de página vazia).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Clique no thumbnail da foto: adiciona o produto (se ainda não estiver) e
  // pede ao pai para abrir o editor daquele produto (igual à aba "Página").
  onEditProduct?: (id: string) => void;
}

interface AddProductRowProps {
  product: {
    id: string;
    name: string;
    sku: string;
    salePrice: number;
    image: string;
  };
  added: boolean;
  saving: boolean;
  // Modo "vincular" (bloco de estilo): sempre permite escolher, mesmo que o
  // produto já esteja no catálogo — o clique (re)liga o produto ao bloco.
  binding: boolean;
  onAdd: (id: string, prices: { de: number; por: number | null }) => void;
  // Clique na foto → abre o editor (opcional). Ausente = foto não clicável.
  onEditPhoto?: (id: string, prices: { de: number; por: number | null }) => void;
}

// Linha do produto na busca: "De R$ / Por R$" editáveis para adição rápida.
function AddProductRow({
  product,
  added,
  saving,
  binding,
  onAdd,
  onEditPhoto,
}: AddProductRowProps) {
  const [de, setDe] = useState<string>(String(product.salePrice));
  const [por, setPor] = useState<string>("");

  const prices = () => ({
    de: Number(de),
    por: por !== "" ? Number(por) : null,
  });
  const submit = () => onAdd(product.id, prices());

  // No modo vincular o botão nunca é desabilitado por "já adicionado".
  const isAdded = added && !binding;
  const photoSrc = product.image
    ? product.image.startsWith("http")
      ? product.image
      : constructUrl(product.image)
    : null;

  return (
    <div className="flex flex-col gap-1.5 rounded px-2 py-2 hover:bg-muted">
      <div className="flex items-center justify-between gap-2">
        {/* Preview da foto — clique abre o editor do produto (como na Página) */}
        <button
          type="button"
          className="relative size-11 shrink-0 overflow-hidden rounded-md border bg-muted"
          title={onEditPhoto ? "Editar produto (foto/etiqueta)" : product.name}
          disabled={!onEditPhoto}
          onClick={() => onEditPhoto?.(product.id, prices())}
        >
          {photoSrc ? (
            // biome-ignore lint/performance/noImgElement: thumbnail de produto
            <img
              src={photoSrc}
              alt={product.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground/50" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm">{product.name}</span>
          <span className="text-xs text-muted-foreground">
            {product.sku || "sem SKU"}
          </span>
        </div>
        <Button
          type="button"
          variant={isAdded ? "secondary" : "outline"}
          size="sm"
          className="ml-2 shrink-0"
          disabled={isAdded || saving}
          onClick={submit}
        >
          {isAdded ? "Adicionado" : "Adicionar"}
        </Button>
      </div>

      {!isAdded && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            De R$
            <Input
              type="number"
              min={0}
              step={0.01}
              className="h-7 w-20 text-xs"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </span>
          <span className="flex items-center gap-1">
            Por R$
            <Input
              type="number"
              min={0}
              step={0.01}
              className="h-7 w-20 text-xs"
              placeholder="promo"
              value={por}
              onChange={(e) => setPor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </span>
        </div>
      )}
    </div>
  );
}

export function AddProductDialog({
  config,
  onConfigChange,
  onPicked,
  triggerLabel,
  triggerClassName,
  title,
  open: openProp,
  onOpenChange,
  onEditProduct,
}: AddProductDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (openProp === undefined) setOpenState(o);
  };
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  // Filtro por categoria (slug). "" = todas.
  const [categorySlug, setCategorySlug] = useState<string>("");
  const priceMutation = useUpdateProductPrice();
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  // Categorias da org (para o filtro e o "adicionar todos desta categoria").
  const { data: catData } = useQuery(
    orpc.categories.listAll.queryOptions({ enabled: open }),
  );
  const categories = catData?.categories ?? [];

  // Volta pra 1ª página ao abrir o diálogo, mudar a busca ou a categoria.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset ao mudar busca/categoria/abrir
  useEffect(() => {
    reset();
  }, [deferredSearch, categorySlug, open, reset]);

  const { data, isLoading, isFetching } = useQuery(
    orpc.products.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        // `search` casa nome OU SKU OU código de barras (EAN).
        search: deferredSearch || undefined,
        category: categorySlug ? [categorySlug] : undefined,
        cursor,
      },
      enabled: open,
      placeholderData: keepPreviousData,
    }),
  );

  // Toggle "adicionar todos os produtos desta categoria": liga = a categoria
  // entra no `categoryFilter` do catálogo (inclui todos os produtos dela).
  const categoryInFilter =
    !!categorySlug && (config.categoryFilter ?? []).includes(categorySlug);
  const toggleWholeCategory = (on: boolean) => {
    if (!categorySlug) return;
    const cur = config.categoryFilter ?? [];
    onConfigChange({
      categoryFilter: on
        ? Array.from(new Set([...cur, categorySlug]))
        : cur.filter((s) => s !== categorySlug),
    });
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE))
    : 1;

  // "Adicionado" = está em manuallyAddedIds E não foi excluído. Sem o `!excluded`
  // um produto adicionado e depois removido (fantasma) apareceria como já
  // adicionado, sem estar no catálogo — impedindo re-adicioná-lo.
  const alreadyAdded = new Set(config.manuallyAddedIds);
  const excludedSet = new Set(config.excludedProductIds);

  const handleAdd = (
    id: string,
    salePrice: number,
    prices: { de: number; por: number | null },
  ) => {
    const changes: Partial<CatalogConfig> = {
      // Set evita id duplicado ao re-adicionar um produto que era fantasma.
      manuallyAddedIds: Array.from(new Set([...config.manuallyAddedIds, id])),
      excludedProductIds: config.excludedProductIds.filter((eid) => eid !== id),
    };

    // "De": preço normal exibido SÓ neste catálogo (override), só se mudou.
    if (
      Number.isFinite(prices.de) &&
      prices.de > 0 &&
      prices.de !== salePrice
    ) {
      changes.priceOverrides = {
        ...(config.priceOverrides ?? {}),
        [id]: prices.de,
      };
    }
    onConfigChange(changes);

    // "Por": preço promocional — grava no cadastro (produto).
    if (prices.por != null && Number.isFinite(prices.por) && prices.por > 0) {
      priceMutation.mutate({ productId: id, promotionalPrice: prices.por });
    }

    // Modo "vincular": devolve o id e fecha (ex.: ligar a um bloco de estilo).
    if (onPicked) {
      onPicked(id);
      setOpen(false);
    }
  };

  // Clique na foto: garante o produto no catálogo e abre o editor dele (aba
  // "Página"). Fecha o diálogo para o editor ficar em foco.
  const handleEditPhoto = onEditProduct
    ? (
        id: string,
        salePrice: number,
        prices: { de: number; por: number | null },
        alreadyAdded: boolean,
      ) => {
        if (!alreadyAdded) handleAdd(id, salePrice, prices);
        onEditProduct(id);
        setOpen(false);
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={
            triggerClassName ??
            "h-10 w-full gap-1.5 rounded-xl text-[14px] lg:h-9 lg:text-[13px]"
          }
        >
          <Plus className="h-4 w-4" />
          {triggerLabel ?? "Adicionar produto"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "Adicionar produto ao catálogo"}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, SKU ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Filtro por categoria + adicionar a categoria inteira */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">
              Categoria
            </span>
            <Select
              value={categorySlug || "__all__"}
              onValueChange={(v) => setCategorySlug(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">
                  Todas as categorias
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {categorySlug && (
            <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
              <Label htmlFor="add-whole-category" className="text-xs">
                Adicionar todos os produtos desta categoria?
              </Label>
              <Switch
                id="add-whole-category"
                checked={categoryInFilter}
                onCheckedChange={toggleWholeCategory}
              />
            </div>
          )}
        </div>

        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {isLoading && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Buscando...
            </p>
          )}
          {!isLoading && data?.products.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          )}
          {data?.products.map((p) => {
            const isAdded = alreadyAdded.has(p.id) && !excludedSet.has(p.id);
            return (
              <AddProductRow
                key={p.id}
                product={p}
                added={isAdded}
                saving={priceMutation.isPending}
                binding={!!onPicked}
                onAdd={(id, prices) => handleAdd(id, p.salePrice, prices)}
                onEditPhoto={
                  handleEditPhoto
                    ? (id, prices) =>
                        handleEditPhoto(id, p.salePrice, prices, isAdded)
                    : undefined
                }
              />
            );
          })}
        </div>

        {data && data.totalCount > 0 && (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Página {pageIndex} de {totalPages}
              <span className="ml-1.5 opacity-60">
                ({data.totalCount} produto{data.totalCount !== 1 ? "s" : ""})
              </span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrevious || isFetching}
                onClick={goPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasNextPage || isFetching}
                onClick={() => goNext(data.nextCursor)}
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
