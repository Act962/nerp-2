"use client";

import { useDeferredValue, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { constructUrl } from "@/hooks/use-construct-url";
import { useSearchCatalogProducts } from "../hooks/use-catalog";

export type PickedProduct = {
  id: string;
  name: string;
  thumbnail: string;
  salePrice: number;
  categoryName: string | null;
};

interface ProductNameSearchProps {
  value: string;
  onChange: (name: string) => void;
  onPick: (product: PickedProduct) => void;
  className?: string;
}

// Input "Nome do produto" que funciona como BUSCA (typeahead) de produtos do
// cadastro. Digitar filtra; escolher um resultado preenche a linha (imagem +
// dados). O dropdown vai num portal (Popover), então não é cortado pela rolagem
// da tabela.
export function ProductNameSearch({
  value,
  onChange,
  onPick,
  className,
}: ProductNameSearchProps) {
  const [open, setOpen] = useState(false);
  const deferred = useDeferredValue(value);
  const { data: results = [], isFetching } = useSearchCatalogProducts(
    deferred,
    open,
  );
  const showList = open && value.trim().length >= 2;

  return (
    <Popover open={showList && (results.length > 0 || isFetching)}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={className}
          placeholder="Buscar produto…"
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={2}
        className="w-80 max-h-72 overflow-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isFetching && results.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
          </div>
        ) : (
          results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(p);
                setOpen(false);
              }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                {p.thumbnail ? (
                  // biome-ignore lint/performance/noImgElement: prévia local
                  <img
                    src={constructUrl(p.thumbnail)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                R$ {p.salePrice.toFixed(2)}
              </span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
