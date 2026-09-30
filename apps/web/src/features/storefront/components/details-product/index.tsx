"use client";

import {
  Check,
  ChevronRight,
  MessageCircleIcon,
  Minus,
  Plus,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import placeholder from "@/assets/background-default-image.svg";
import { SafeContent } from "@/components/rich-text/safe-content";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalogSettings } from "@/features/storefront/hooks/use-catalog-settings";
import { useProductDetails } from "@/features/storefront/hooks/use-product-details";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import {
  TEMA_PADRAO_CATALOGO,
  isHexValido,
  tintaSobre,
} from "@/features/storefront/lib/cores";
import { useCart } from "@/hooks/use-cart";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { ProductCard, precoEmOferta } from "../catalog/product-card";

interface DetailsPoductProps {
  subdomain: string;
  slug: string;
}

/** Mesma montagem de URL do resto da vitrine; sem chave, a imagem padrão. */
function urlDaFoto(chave: string | null | undefined) {
  return (chave && constructUrl(chave)) || placeholder;
}

export function DetailsPoduct({ subdomain, slug }: DetailsPoductProps) {
  const { data, isLoading, error } = useProductDetails({ subdomain, slug });
  const { data: catalogSettings, isLoading: isCatalogSettingsLoading } =
    useCatalogSettings({ subdomain });
  const { products, updateQuantity, isProductInCart, toggleProduct } =
    useCart(subdomain);

  const homeHref = useCatalogHref("/");
  const [quantity, setQuantity] = useState<number>(1);
  const [isMounted, setIsMounted] = useState(false);
  const [imageSelected, setImageSelected] = useState<string | null>(null);
  // Fotos cujo arquivo sumiu do storage: somem da galeria em vez de
  // aparecerem como ícone quebrado com o texto alternativo.
  const [fotosQuebradas, setFotosQuebradas] = useState<string[]>([]);

  const product = data?.product;
  const productsWithThisCategory = data?.productsWithThisCategory;
  const quantidadeNoCarrinho = product
    ? products.find((item) => item.productId === product.id)?.quantity
    : undefined;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!product) return;
    setImageSelected(product.thumbnail);
    setQuantity(Number(quantidadeNoCarrinho) || 1);
  }, [product, quantidadeNoCarrinho]);

  if (isLoading || isCatalogSettingsLoading) return <EsqueletoDoProduto />;

  if (error || !product || !productsWithThisCategory) {
    notFound();
  }

  const tema = isHexValido(catalogSettings?.theme)
    ? catalogSettings.theme
    : TEMA_PADRAO_CATALOGO;
  const corDoTema = { backgroundColor: tema, color: tintaSobre(tema) };

  const noCarrinho = isMounted && isProductInCart(product.id);
  const disponivel = data?.productIsDisponile === true;
  // Catálogo sem preço: o cliente monta a lista e pede orçamento.
  const mostrarPreco = catalogSettings?.showPrices !== false;
  const oferta = mostrarPreco
    ? precoEmOferta(product.salePrice, product.promotionalPrice)
    : null;
  const desconto = oferta
    ? Math.round((1 - oferta / product.salePrice) * 100)
    : 0;
  const categoria = product.category as { name: string; slug: string } | null;
  const categoriaHref = categoria
    ? `${homeHref}?categories=${encodeURIComponent(categoria.slug)}`
    : homeHref;

  // A capa primeiro, depois as fotos extras — sem repetir e sem as quebradas.
  const galeria = [product.thumbnail, ...(product.images ?? [])].filter(
    (foto, indice, lista): foto is string =>
      !!foto &&
      lista.indexOf(foto) === indice &&
      !fotosQuebradas.includes(foto),
  );
  const fotoAtual =
    imageSelected && !fotosQuebradas.includes(imageSelected)
      ? urlDaFoto(imageSelected)
      : placeholder;

  const whatsapp = catalogSettings?.whatsappNumber?.trim();

  const mudarQuantidade = (nova: number) => {
    if (nova < 1) return;
    setQuantity(nova);
    updateQuantity(product.id, subdomain, nova.toString());
  };

  function descricao() {
    if (!product?.description) return null;
    try {
      return JSON.parse(product.description);
    } catch {
      return product.description;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-5 sm:py-7">
      <nav
        aria-label="Caminho"
        className="flex flex-wrap items-center gap-1.5 text-sm opacity-80"
      >
        <Link href={homeHref} className="hover:underline">
          Início
        </Link>
        {categoria && (
          <>
            <ChevronRight className="size-3.5" />
            <Link href={categoriaHref} className="hover:underline">
              {categoria.name}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="truncate font-medium">{product.name}</span>
      </nav>

      <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col gap-3">
          {/*
            O arredondamento fica na caixa, com a imagem recortada por ela:
            arredondar a imagem por dentro de uma caixa colorida deixava a cor
            de fundo aparecendo nos quatro cantos.
          */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xs">
            {desconto > 0 && (
              <span
                className="absolute top-4 left-4 z-10 rounded-full px-3 py-1 font-semibold text-sm"
                style={corDoTema}
              >
                -{desconto}%
              </span>
            )}
            <Image
              src={fotoAtual}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6 sm:p-10"
              onError={() =>
                imageSelected &&
                setFotosQuebradas((atuais) => [...atuais, imageSelected])
              }
            />
          </div>

          {galeria.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {galeria.map((foto) => (
                <button
                  key={foto}
                  type="button"
                  aria-label="Ver esta foto"
                  aria-pressed={imageSelected === foto}
                  onClick={() => setImageSelected(foto)}
                  className="relative size-16 shrink-0 overflow-hidden rounded-lg border-2 border-transparent bg-white shadow-xs sm:size-20"
                  style={
                    imageSelected === foto ? { borderColor: tema } : undefined
                  }
                >
                  <Image
                    src={urlDaFoto(foto)}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-contain p-1.5"
                    onError={() =>
                      setFotosQuebradas((atuais) => [...atuais, foto])
                    }
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-5 rounded-2xl border border-black/5 bg-white p-6 text-neutral-900 shadow-xs sm:p-8">
          <div className="flex flex-col gap-2">
            {categoria && (
              <Link
                href={categoriaHref}
                className="w-fit text-neutral-500 text-xs uppercase tracking-wide hover:underline"
              >
                {categoria.name}
              </Link>
            )}
            <h1 className="font-bold text-2xl leading-tight sm:text-3xl">
              {product.name}
            </h1>
            {product.sku && (
              <span className="text-neutral-500 text-xs">
                Código: {product.sku}
              </span>
            )}
          </div>

          {mostrarPreco ? (
            <div className="flex flex-col gap-1">
              {oferta && (
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 line-through">
                    R$ {currencyFormatter(product.salePrice)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 font-semibold text-xs"
                    style={corDoTema}
                  >
                    -{desconto}%
                  </span>
                </div>
              )}
              <span
                className={cn(
                  "font-bold text-4xl sm:text-5xl",
                  oferta && "text-red-600",
                )}
              >
                R$ {currencyFormatter(oferta ?? product.salePrice)}
              </span>
              {oferta && (
                <span className="text-neutral-600 text-sm">
                  Você economiza R${" "}
                  {currencyFormatter(product.salePrice - oferta)}
                </span>
              )}
            </div>
          ) : (
            <p className="rounded-xl bg-neutral-50 p-3 text-neutral-600 text-sm">
              Os valores são combinados com a loja. Adicione os itens e peça o
              seu orçamento.
            </p>
          )}

          <div
            className={cn(
              "flex items-center gap-2 font-medium text-sm",
              disponivel ? "text-emerald-700" : "text-red-600",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                disponivel ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            {disponivel
              ? catalogSettings?.showStock
                ? `${product.currentStock} em estoque`
                : "Disponível"
              : "Esgotado"}
          </div>

          <div className="h-px bg-neutral-200" />

          {catalogSettings?.allowOrders && disponivel && (
            <div className="flex flex-col gap-2">
              <span className="text-neutral-500 text-sm">Quantidade</span>
              <div className="flex w-fit items-center rounded-full border border-neutral-300">
                <button
                  type="button"
                  aria-label="Diminuir"
                  disabled={quantity <= 1}
                  onClick={() => mudarQuantidade(quantity - 1)}
                  className="flex size-11 items-center justify-center rounded-full hover:bg-neutral-100 disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-10 text-center font-semibold">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar"
                  onClick={() => mudarQuantidade(quantity + 1)}
                  className="flex size-11 items-center justify-center rounded-full hover:bg-neutral-100"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {catalogSettings?.allowOrders &&
              (disponivel ? (
                <button
                  type="button"
                  aria-pressed={noCarrinho}
                  onClick={() => toggleProduct(product.id, quantity.toString())}
                  className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full font-semibold text-base shadow-sm transition-transform active:scale-[0.98]"
                  style={corDoTema}
                >
                  {noCarrinho ? (
                    <>
                      <Check className="size-5" /> No pedido · tirar
                    </>
                  ) : (
                    <>
                      <Plus className="size-5" />{" "}
                      {mostrarPreco
                        ? "Adicionar ao pedido"
                        : "Adicionar ao orçamento"}
                    </>
                  )}
                </button>
              ) : (
                <span className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-neutral-100 font-semibold text-neutral-500">
                  <X className="size-5" /> Indisponível
                </span>
              ))}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá, gostaria de comprar o produto ${product.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full border-2 border-emerald-600 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                <MessageCircleIcon className="size-5" />
                {catalogSettings?.allowOrders
                  ? "Comprar pelo WhatsApp"
                  : "Conversar pelo WhatsApp"}
              </a>
            )}
          </div>
        </div>
      </section>

      {product.description && (
        <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-6 text-neutral-900 shadow-xs sm:p-8">
          <h2 className="font-bold text-xl">Descrição</h2>
          <SafeContent
            content={descricao()}
            className="prose prose-sm max-w-none prose-hr:border-neutral-200 prose-p:my-1 text-neutral-700 marker:text-neutral-400"
          />
        </section>
      )}

      {productsWithThisCategory.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-xl sm:text-2xl">
              Outros produtos desta categoria
            </h2>
            {categoria && (
              <Link
                href={categoriaHref}
                className="shrink-0 font-medium text-sm hover:underline"
              >
                Ver todos
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {productsWithThisCategory.map((relacionado) => (
              <li key={relacionado.id} className="flex">
                <ProductCard
                  className="w-full"
                  id={relacionado.id}
                  name={relacionado.name}
                  slug={relacionado.slug}
                  thumbnail={relacionado.thumbnail}
                  salePrice={relacionado.salePrice}
                  promotionalPrice={relacionado.promotionalPrice}
                  categoria={categoria?.name}
                  subdomain={subdomain}
                  isDisponile={relacionado.currentStock > 0}
                  allowsOrders={catalogSettings?.allowOrders}
                  mostrarPreco={mostrarPreco}
                  tema={tema}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EsqueletoDoProduto() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-5 sm:py-7">
      <Skeleton className="h-4 w-56 bg-accent-foreground/10" />
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Skeleton className="aspect-square w-full rounded-2xl bg-accent-foreground/10" />
        <div className="flex flex-col gap-4 rounded-2xl bg-accent-foreground/5 p-8">
          <Skeleton className="h-4 w-24 bg-accent-foreground/10" />
          <Skeleton className="h-9 w-3/4 bg-accent-foreground/10" />
          <Skeleton className="h-12 w-40 bg-accent-foreground/10" />
          <Skeleton className="h-4 w-28 bg-accent-foreground/10" />
          <Skeleton className="h-11 w-36 rounded-full bg-accent-foreground/10" />
          <Skeleton className="h-13 w-full rounded-full bg-accent-foreground/10" />
        </div>
      </div>
    </div>
  );
}
