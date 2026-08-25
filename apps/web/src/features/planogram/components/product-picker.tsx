"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { constructUrl } from "@/hooks/use-construct-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Pencil, Search } from "lucide-react";
import { useState } from "react";
import { formatMm } from "../engine/units";
import type { ProductRef } from "../engine/types";
import { useProductSearch } from "../hooks/use-planograms";

interface ProductPickerProps {
  onPickProduct: (product: ProductRef) => void;
  onNeedsDimensions: (product: ProductRef) => void;
  onEditProduct: (product: ProductRef) => void;
}

export function ProductPicker({
  onPickProduct,
  onNeedsDimensions,
  onEditProduct,
}: ProductPickerProps) {
  const [term, setTerm] = useState("");
  const [onlyMeasured, setOnlyMeasured] = useState(false);
  const debounced = useDebouncedValue(term, 300);

  const {
    products,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductSearch({ q: debounced, onlyWithDimensions: onlyMeasured });

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar produto ou EAN…"
          className="pl-7"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={onlyMeasured} onCheckedChange={setOnlyMeasured} />
        Só produtos já medidos
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {debounced
              ? "Nenhum produto encontrado."
              : "Digite para buscar um produto."}
          </p>
        )}

        {products.map((product) => {
          const measured = product.widthMm != null && product.heightMm != null;
          return (
            // Div e não button no contêiner: o botão de editar precisa ser
            // um alvo próprio, e botão dentro de botão é HTML inválido.
            // biome-ignore lint/a11y/noStaticElementInteractions: o arraste é atalho; posicionar e editar têm botões próprios e acessíveis por teclado dentro deste contêiner
            <div
              key={product.id}
              // Drag nativo e não @dnd-kit: o Stage do Konva não é um droppable
              // DOM comum, e cruzar as duas bibliotecas custa mais do que ganha.
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/x-product-id",
                  product.id,
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              className="flex w-full items-center gap-2 rounded-md border p-2 transition-colors hover:border-primary"
            >
              <button
                type="button"
                onClick={() =>
                  measured ? onPickProduct(product) : onNeedsDimensions(product)
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {product.thumbnail ? (
                  // biome-ignore lint/performance/noImgElement: preview de key do R2
                  <img
                    src={constructUrl(product.thumbnail)}
                    alt=""
                    className="size-10 shrink-0 rounded border bg-muted object-contain"
                  />
                ) : (
                  <div className="size-10 shrink-0 rounded border bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {measured
                      ? `${formatMm(product.widthMm ?? 0, { unit: false })} × ${formatMm(product.heightMm ?? 0)}`
                      : "sem medidas"}
                  </p>
                </div>
                {!measured && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    medir
                  </Badge>
                )}
              </button>
              <button
                type="button"
                title="Editar medidas e foto"
                aria-label={`Editar medidas e foto de ${product.name}`}
                onClick={() => onEditProduct(product)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          );
        })}

        {hasNextPage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? <Spinner /> : "Carregar mais"}
          </Button>
        )}
      </div>
    </div>
  );
}
