"use client";

import { Input } from "@/components/ui/input";
import { constructUrl } from "@/hooks/use-construct-url";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Search } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

type Produto = {
  id: string;
  name: string;
  thumbnail: string | null;
  salePrice: number;
  prepTimeMinutes: number | null;
  categoryName: string | null;
};

/**
 * Grade de fotos para montar o pedido no balcão.
 *
 * O critério é o tempo do cliente na fila: UM toque por item. O formulário
 * detalhado continua embaixo para o que não está no catálogo ("meia porção",
 * "o de sempre do seu Zé"), mas o caminho comum não passa por ele.
 */
export function ProductGrid({
  produtos,
  aoEscolher,
  contagemPorProduto,
}: {
  produtos: Produto[];
  aoEscolher: (produto: Produto) => void;
  contagemPorProduto: Record<string, number>;
}) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) => p.name.toLowerCase().includes(termo));
  }, [busca, produtos]);

  if (produtos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar item"
          className="h-12 pl-9 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visiveis.map((produto) => {
          const quantos = contagemPorProduto[produto.id] ?? 0;
          return (
            <button
              key={produto.id}
              type="button"
              onClick={() => aoEscolher(produto)}
              className="relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors active:bg-muted"
            >
              {produto.thumbnail ? (
                <Image
                  src={constructUrl(produto.thumbnail)}
                  alt=""
                  width={200}
                  height={120}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="h-24 w-full bg-muted" />
              )}
              <div className="flex flex-1 flex-col p-2">
                <span className="line-clamp-2 text-sm font-medium leading-tight">
                  {produto.name}
                </span>
                <span className="mt-1 text-base font-semibold">
                  R$ {currencyFormatter(produto.salePrice).trim()}
                </span>
              </div>
              {quantos > 0 && (
                <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {quantos}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
