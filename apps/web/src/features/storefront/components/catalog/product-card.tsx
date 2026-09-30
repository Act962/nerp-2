"use client";

import { Check, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import placeholder from "@/assets/background-default-image.svg";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import { tintaSobre } from "@/features/storefront/lib/cores";
import { useCart } from "@/hooks/use-cart";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";

/**
 * - `grade`: o cartão em pé da lista de produtos.
 * - `horizontal`: foto ao lado do texto, para duas ofertas dividirem a linha.
 * - `destaque`: uma oferta sozinha ocupando a largura inteira.
 */
export type FormatoDoCartao = "grade" | "horizontal" | "destaque";

interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  salePrice: number;
  promotionalPrice: number | null;
  categoria?: string;
  subdomain: string;
  isDisponile: boolean;
  allowsOrders?: boolean;
  tema: string;
  formato?: FormatoDoCartao;
  /** Catálogo sem preço (pedido de orçamento): some o preço e o selo. */
  mostrarPreco?: boolean;
  className?: string;
}

/**
 * Preço promocional só vale quando existe e é menor que o de venda: a API
 * devolve `Number(null)`, que é 0, para quem não tem promoção.
 */
export function precoEmOferta(
  salePrice: number,
  promotionalPrice: number | null,
): number | null {
  return promotionalPrice &&
    promotionalPrice > 0 &&
    promotionalPrice < salePrice
    ? promotionalPrice
    : null;
}

export function ProductCard({
  id,
  name,
  slug,
  thumbnail,
  salePrice,
  promotionalPrice,
  categoria,
  subdomain,
  isDisponile,
  allowsOrders,
  tema,
  formato = "grade",
  mostrarPreco = true,
  className,
}: ProductCardProps) {
  const { toggleProduct, isProductInCart } = useCart(subdomain);
  // O carrinho mora no navegador: antes de montar, o servidor não sabe o que
  // está nele, e marcar "adicionado" no SSR daria erro de hidratação.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  // A chave pode apontar para um arquivo que sumiu do storage: sem isto o
  // navegador desenha o texto alternativo por cima do cartão.
  const [fotoQuebrou, setFotoQuebrou] = useState(false);

  const productHref = useCatalogHref(`/${slug}`);
  const noCarrinho = montado && isProductInCart(id);
  const oferta = mostrarPreco
    ? precoEmOferta(salePrice, promotionalPrice)
    : null;
  const desconto = oferta ? Math.round((1 - oferta / salePrice) * 100) : 0;
  const imagem =
    !fotoQuebrou && thumbnail && thumbnail.trim() !== ""
      ? constructUrl(thumbnail)
      : placeholder;

  const deitado = formato !== "grade";
  const grande = formato === "destaque";
  const corDoTema = { backgroundColor: tema, color: tintaSobre(tema) };

  return (
    <div
      id={id}
      className={cn(
        "group relative flex overflow-hidden rounded-xl border border-black/5 bg-white text-neutral-900 shadow-xs transition-shadow hover:shadow-md",
        deitado ? "flex-row" : "flex-col",
        grande && "flex-col sm:flex-row",
        className,
      )}
    >
      {desconto > 0 && (
        <span
          className={cn(
            "absolute z-10 rounded-full font-semibold",
            grande
              ? "top-4 left-4 px-3 py-1 text-sm"
              : "top-2.5 left-2.5 px-2 py-0.5 text-[11px]",
          )}
          style={corDoTema}
        >
          -{desconto}%
        </span>
      )}

      <Link
        href={productHref}
        aria-label={name}
        className={cn(
          "relative shrink-0 bg-white",
          formato === "grade" && "aspect-square w-full",
          formato === "horizontal" && "aspect-square w-2/5",
          grande && "aspect-square w-full sm:aspect-auto sm:min-h-72 sm:w-1/2",
        )}
      >
        <Image
          src={imagem}
          alt={name}
          fill
          sizes={
            grande
              ? "(max-width: 640px) 100vw, 50vw"
              : "(max-width: 640px) 50vw, 20vw"
          }
          onError={() => setFotoQuebrou(true)}
          className={cn(
            "object-contain transition-transform duration-300 group-hover:scale-105",
            grande ? "p-6 sm:p-10" : "p-3",
          )}
        />
      </Link>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          formato === "grade" && "gap-1 px-3 pt-2 pb-3",
          formato === "horizontal" && "gap-1.5 p-4",
          grande && "justify-center gap-3 p-6 sm:p-10",
        )}
      >
        {categoria && (
          <span
            className={cn(
              "truncate text-neutral-500 uppercase tracking-wide",
              grande ? "text-xs" : "text-[11px]",
            )}
          >
            {categoria}
          </span>
        )}
        <Link
          href={productHref}
          title={name}
          className={cn(
            "font-medium hover:underline",
            formato === "grade" && "line-clamp-2 min-h-10 text-sm leading-5",
            formato === "horizontal" && "line-clamp-3 text-base leading-snug",
            grande &&
              "line-clamp-3 font-bold text-2xl leading-tight sm:text-3xl",
          )}
        >
          {name}
        </Link>

        <div
          className={cn(
            "flex gap-2",
            grande
              ? "flex-col items-start gap-4 pt-2"
              : "mt-auto items-end justify-between pt-1",
          )}
        >
          <div className={cn("flex flex-col", !mostrarPreco && "hidden")}>
            {oferta && (
              <span
                className={cn(
                  "text-neutral-500 line-through",
                  grande ? "text-base" : "text-xs",
                )}
              >
                R$ {currencyFormatter(salePrice)}
              </span>
            )}
            <span
              className={cn(
                "font-bold",
                oferta && "text-red-600",
                formato === "grade" && "text-base",
                formato === "horizontal" && "text-xl",
                grande && "text-4xl sm:text-5xl",
              )}
            >
              R$ {currencyFormatter(oferta ?? salePrice)}
            </span>
            {grande && oferta && (
              <span className="text-neutral-600 text-sm">
                Você economiza R$ {currencyFormatter(salePrice - oferta)}
              </span>
            )}
          </div>

          {allowsOrders &&
            (isDisponile ? (
              <button
                type="button"
                onClick={() => toggleProduct(id, "1")}
                aria-label={
                  noCarrinho
                    ? "Tirar do pedido"
                    : mostrarPreco
                      ? "Adicionar ao pedido"
                      : "Adicionar ao orçamento"
                }
                aria-pressed={noCarrinho}
                className={cn(
                  "flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold shadow-sm transition-transform active:scale-95",
                  grande ? "h-12 px-6 text-base" : "ml-auto size-9",
                )}
                style={corDoTema}
              >
                {noCarrinho ? (
                  <Check className={grande ? "size-5" : "size-4"} />
                ) : (
                  <Plus className={grande ? "size-5" : "size-4"} />
                )}
                {grande &&
                  (noCarrinho
                    ? "No pedido"
                    : mostrarPreco
                      ? "Adicionar ao pedido"
                      : "Adicionar ao orçamento")}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[11px] text-neutral-500">
                Esgotado
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
