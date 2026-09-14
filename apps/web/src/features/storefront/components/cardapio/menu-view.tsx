"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalogSettings } from "@/features/storefront/hooks/use-catalog-settings";
import { useQueryCatalogProducts } from "@/features/storefront/hooks/use-catalog-products";
import { useCart } from "@/hooks/use-cart";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { ItemSheet } from "./item-sheet";
import { MenuCartSheet } from "./menu-cart-sheet";

/**
 * O cardápio: a mesma loja, desenhada para quem está com fome e com uma mão só.
 *
 * Regras que moldaram o leiaute, e que valem mais que qualquer detalhe visual:
 * foto grande (comida se escolhe pelo olho), preço legível sem apertar os
 * olhos, o "+" dentro do próprio card (adicionar em UM toque) e a sacola fixa
 * no rodapé, para o cliente nunca ter que procurar como finalizar.
 */
const ESQUELETO = ["a", "b", "c", "d"];

export function MenuView({ subdomain }: { subdomain: string }) {
  const { data: settings } = useCatalogSettings({ subdomain });
  const { data, isLoadingProducts } = useQueryCatalogProducts({ subdomain });
  const carrinho = useCart(subdomain);

  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const [sacolaAberta, setSacolaAberta] = useState(false);

  const produtos = useMemo(
    () => (data?.products ?? []).filter((p) => p.productIsDisponile),
    [data?.products],
  );

  const categorias = useMemo(() => {
    const comProduto = new Set(produtos.map((p) => p.categoryId));
    return (data?.categories ?? []).filter((c) => comProduto.has(c.id));
  }, [data?.categories, produtos]);

  const visiveis = categoriaAtiva
    ? produtos.filter((p) => p.categoryId === categoriaAtiva)
    : produtos;

  const totalDeItens = carrinho.products.reduce(
    (soma, item) => soma + Number(item.quantity || 0),
    0,
  );

  const totalEmReais = carrinho.products.reduce((soma, item) => {
    const produto = produtos.find((p) => p.id === item.productId);
    if (!produto) return soma;
    return soma + preco(produto) * Number(item.quantity || 0);
  }, 0);

  const produtoAberto = produtos.find((p) => p.id === itemAberto) ?? null;

  if (isLoadingProducts) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-9 w-full" />
        {ESQUELETO.map((chave) => (
          <Skeleton key={chave} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col pb-28">
      <header className="px-4 pt-5">
        <h1 className="text-2xl font-bold">
          {settings?.metaTitle || "Cardápio"}
        </h1>
        <p className="text-muted-foreground">
          Escolha, peça e acompanhe pelo celular.
        </p>
      </header>

      {categorias.length > 0 && (
        // Faixa horizontal e grudada no topo: com o polegar na tela, trocar de
        // categoria não pode custar uma rolagem inteira.
        <nav className="sticky top-0 z-10 mt-4 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-3 backdrop-blur">
          <CategoriaChip
            ativa={categoriaAtiva === null}
            onClick={() => setCategoriaAtiva(null)}
          >
            Tudo
          </CategoriaChip>
          {categorias.map((categoria) => (
            <CategoriaChip
              key={categoria.id}
              ativa={categoriaAtiva === categoria.id}
              onClick={() => setCategoriaAtiva(categoria.id)}
            >
              {categoria.name}
            </CategoriaChip>
          ))}
        </nav>
      )}

      <ul className="flex flex-col gap-3 p-4">
        {visiveis.map((produto) => {
          const noCarrinho = carrinho.products.find(
            (item) => item.productId === produto.id,
          );
          return (
            <li key={produto.id}>
              <button
                type="button"
                onClick={() => setItemAberto(produto.id)}
                className="flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors active:bg-muted"
              >
                {produto.thumbnail ? (
                  <Image
                    src={constructUrl(produto.thumbnail)}
                    alt=""
                    width={96}
                    height={96}
                    className="size-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-24 shrink-0 rounded-lg bg-muted" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-tight">
                    {produto.name}
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    R$ {currencyFormatter(preco(produto)).trim()}
                  </p>
                  {noCarrinho && (
                    <p className="mt-1 text-sm font-medium text-primary">
                      {noCarrinho.quantity} na sacola
                    </p>
                  )}
                </div>

                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
                >
                  +
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {visiveis.length === 0 && (
        <p className="px-4 py-10 text-center text-muted-foreground">
          Nada disponível nesta categoria agora.
        </p>
      )}

      {totalDeItens > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background p-3">
          <Button
            size="lg"
            className="h-14 w-full justify-between text-base"
            onClick={() => setSacolaAberta(true)}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" />
              {totalDeItens} {totalDeItens === 1 ? "item" : "itens"}
            </span>
            <span>
              Ver sacola · R$ {currencyFormatter(totalEmReais).trim()}
            </span>
          </Button>
        </div>
      )}

      <ItemSheet
        produto={produtoAberto}
        aberto={produtoAberto !== null}
        aoFechar={() => setItemAberto(null)}
        noCarrinho={
          carrinho.products.find((item) => item.productId === itemAberto) ??
          null
        }
        aoAdicionar={(quantidade, observacao) => {
          if (!produtoAberto) return;
          carrinho.addProduct(produtoAberto.id, String(quantidade), observacao);
          setItemAberto(null);
        }}
        aoRemover={() => {
          if (!produtoAberto) return;
          carrinho.toggleProduct(produtoAberto.id, "0");
          setItemAberto(null);
        }}
      />

      <MenuCartSheet
        aberta={sacolaAberta}
        aoFechar={() => setSacolaAberta(false)}
        subdomain={subdomain}
        produtos={produtos}
      />
    </div>
  );
}

export function preco(produto: {
  salePrice: number;
  promotionalPrice: number | null;
}): number {
  return produto.promotionalPrice && produto.promotionalPrice > 0
    ? produto.promotionalPrice
    : produto.salePrice;
}

function CategoriaChip({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-base font-medium transition-colors",
        ativa
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background",
      )}
    >
      {children}
    </button>
  );
}
