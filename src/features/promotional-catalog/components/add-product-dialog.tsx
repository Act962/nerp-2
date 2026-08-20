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
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useUpdateProductPrice } from "../hooks/use-catalog";
import type { CatalogConfig } from "../types";

// Página pequena: nunca despeja a lista inteira de produtos no diálogo.
const PAGE_SIZE = 8;

interface AddProductDialogProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}

interface AddProductRowProps {
  product: { id: string; name: string; sku: string; salePrice: number };
  added: boolean;
  saving: boolean;
  onAdd: (id: string, prices: { de: number; por: number | null }) => void;
}

// Linha do produto na busca: "De R$ / Por R$" editáveis para adição rápida.
function AddProductRow({ product, added, saving, onAdd }: AddProductRowProps) {
  const [de, setDe] = useState<string>(String(product.salePrice));
  const [por, setPor] = useState<string>("");

  const submit = () =>
    onAdd(product.id, {
      de: Number(de),
      por: por !== "" ? Number(por) : null,
    });

  return (
    <div className="flex flex-col gap-1.5 rounded px-2 py-2 hover:bg-muted">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{product.name}</span>
          <span className="text-xs text-muted-foreground">
            {product.sku || "sem SKU"}
          </span>
        </div>
        <Button
          type="button"
          variant={added ? "secondary" : "outline"}
          size="sm"
          className="ml-2 shrink-0"
          disabled={added || saving}
          onClick={submit}
        >
          {added ? "Adicionado" : "Adicionar"}
        </Button>
      </div>

      {!added && (
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
}: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const priceMutation = useUpdateProductPrice();
  const { cursor, pageIndex, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  // Volta pra 1ª página ao abrir o diálogo ou mudar a busca (deps são gatilhos).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset ao mudar busca/abrir
  useEffect(() => {
    reset();
  }, [deferredSearch, open, reset]);

  const { data, isLoading, isFetching } = useQuery(
    orpc.products.list.queryOptions({
      input: {
        limit: PAGE_SIZE,
        name: deferredSearch || undefined,
        cursor,
      },
      enabled: open,
      placeholderData: keepPreviousData,
    }),
  );

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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-1 w-full">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar produto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar produto ao catálogo</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
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
          {data?.products.map((p) => (
            <AddProductRow
              key={p.id}
              product={p}
              added={alreadyAdded.has(p.id) && !excludedSet.has(p.id)}
              saving={priceMutation.isPending}
              onAdd={(id, prices) => handleAdd(id, p.salePrice, prices)}
            />
          ))}
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
