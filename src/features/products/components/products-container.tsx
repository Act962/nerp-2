"use client";

import { Button } from "@/components/ui/button";
import { ImageIcon, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { ProductsTable } from "./products-table";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useQueryState } from "nuqs";
import dayjs from "dayjs";
import { useEffect } from "react";
import { useProducts } from "@/features/products/hooks/use-products";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useCategory } from "@/context/category/hooks/use-categories";

export function ProductsContainer() {
  const [category] = useQueryState("category");
  const [sku] = useQueryState("sku");
  const [minValue] = useQueryState("min_value");
  const [maxValue] = useQueryState("max_value");
  const [dateInit] = useQueryState("date_init");
  const [dateEnd] = useQueryState("date_end");

  const { cursor, hasPrevious, goNext, goPrevious, reset } =
    useCursorPagination();

  // Volta para a primeira página sempre que algum filtro mudar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: as deps de filtro são intencionais — reiniciam a paginação ao mudar qualquer filtro.
  useEffect(() => {
    reset();
  }, [category, sku, minValue, maxValue, dateInit, dateEnd, reset]);

  const {
    data: products,
    nextCursor,
    hasNextPage,
  } = useProducts({
    category: category?.split(",").map((c) => c.trim()),
    sku: sku ?? undefined,
    minValue: minValue ?? undefined,
    maxValue: maxValue ?? undefined,
    dateInit: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
    dateEnd: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
    cursor,
    limit: 10,
  });

  const { categories } = useCategory();

  return (
    <div className="px-4 mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Lista de Produtos</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie seu catálogo de produtos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size={"sm"} variant={"outline"} asChild>
            <Link href={"/produtos/importar"}>
              <Upload className="size-4" />
              Importar
            </Link>
          </Button>
          <Button size={"sm"} variant={"outline"} asChild>
            <Link href={"/produtos/importar-imagens"}>
              <ImageIcon className="size-4" />
              Importar imagens
            </Link>
          </Button>
          <Button size={"sm"} asChild>
            <Link href={"/produtos/novo"}>
              <Plus className="size-4" />
              Adicionar Produto
            </Link>
          </Button>
        </div>
      </div>

      <ProductsTable
        products={products.map((product) => ({
          ...product,
          image: product.image ? useConstructUrl(product.image) : "",
        }))}
        categories={categories}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPrevious}
        onNextPage={() => goNext(nextCursor)}
        onPreviousPage={goPrevious}
      />
    </div>
  );
}
