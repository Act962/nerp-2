"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProducts } from "@/features/products/hooks/use-products";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { client } from "@/lib/orpc";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { QuickCreateProductDialog } from "./quick-create-product-dialog";

export interface PickedProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  trackStock: boolean;
}

/**
 * Como um produto entra na nota: digitando, ou bipando.
 *
 * O bipe faz lookup EXATO por código de barras/SKU e cai direto na linha — o
 * operador tem a nota numa mão e o leitor na outra, e parar para escolher num
 * dropdown a cada item destruiria o ritmo. Código que não casa com nada abre o
 * cadastro rápido já preenchido, porque numa entrada de mercadoria "produto
 * que ainda não existe" é rotina, não exceção.
 */
export function ItemSearch({
  onPick,
  supplierId,
  disabled,
}: {
  onPick: (product: PickedProduct) => void;
  supplierId: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [codigoNovo, setCodigoNovo] = useState<string | null>(null);
  const search = useDebouncedValue(term, 200);
  const { data, isLoading } = useProducts({ search, limit: 8 });

  const escolher = (product: PickedProduct) => {
    onPick(product);
    setTerm("");
    setOpen(false);
  };

  // O leitor só é ouvido com o dropdown fechado: com ele aberto, a rajada de
  // teclas é para o campo de busca.
  useBarcodeScan(!disabled && !open, async (code) => {
    try {
      const { product } = await client.products.findByCode({ code });
      if (product) {
        escolher(product);
        return;
      }
      setCodigoNovo(code);
    } catch {
      toast.error("Não foi possível ler o código");
    }
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              disabled={disabled}
              className="flex-1 justify-start gap-2 text-muted-foreground font-normal"
            >
              <Search className="size-4" />
              Buscar produto por nome, SKU ou código — ou bipar
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Nome, SKU ou código de barras..."
                value={term}
                onValueChange={setTerm}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? "Buscando..." : "Nenhum produto encontrado"}
                </CommandEmpty>
                <CommandGroup>
                  {data.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      className="cursor-pointer"
                      onSelect={() =>
                        escolher({
                          id: product.id,
                          name: product.name,
                          sku: product.sku || null,
                          barcode: product.barcode || null,
                          unit: product.unit,
                          costPrice: product.costPrice,
                          salePrice: product.salePrice,
                          currentStock: product.currentStock,
                          trackStock: product.trackStock,
                        })
                      }
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.sku || product.barcode || "sem código"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          custo {currencyFormatter(product.costPrice)}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setCodigoNovo("")}
        >
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>

      <QuickCreateProductDialog
        barcode={codigoNovo}
        supplierId={supplierId}
        onOpenChange={(aberto) => {
          if (!aberto) setCodigoNovo(null);
        }}
        onCreated={(product) => {
          setCodigoNovo(null);
          onPick(product);
        }}
      />
    </>
  );
}
