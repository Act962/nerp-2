"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Handbag, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getContrastColor } from "@/utils/get-contrast-color";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useCart } from "@/hooks/use-cart";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import { useQueryProductsOfCart } from "@/features/products/hooks/use-products";
import { ItemRequested } from "./item-requested";

interface Settings {
  metaTitle: string | null;
  theme: string | null;
  organizationId: string;
  bannerImage: string | null;
  subdomain: string;
  allowOrders: boolean;
}

interface HeaderProps {
  settings: Settings;
}

export function Header({ settings }: HeaderProps) {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const { products, updateQuantity, toggleProduct } = useCart(
    settings.subdomain,
  );
  const homeHref = useCatalogHref("/");
  const aboutHref = useCatalogHref("/sobre-nos");
  const cartHref = useCatalogHref("/cart");
  const accountHref = useCatalogHref("/account");

  const { data: productsOfCart } = useQueryProductsOfCart({
    subdomain: settings.subdomain,
    productIds: products.map((product) => product.productId) || [],
  });

  const findAndConvertQuantity = (productId: string) => {
    const product = products.find((product) => product.productId === productId);
    return Number(product?.quantity || 0);
  };

  const cartItems = productsOfCart?.map((item) => ({
    id: item.id,
    name: item.name,
    salePrice: item.salePrice,
    thumbnail: item.thumbnail,
    slug: item.slug,
    organizationId: item.organizationId,
    quantity: findAndConvertQuantity(item.id),
  }));

  const isEmpty = cartItems.length === 0;

  const backgroundColor = settings.theme ?? "var(--accent-foreground)";
  const contrastColor = getContrastColor(backgroundColor);

  function handleGoToCart() {
    setModalIsOpen(false);
  }

  const updateQuantityCart = (productId: string, quantity: string) => {
    updateQuantity(productId, settings.subdomain, quantity);
  };

  return (
    <header
      className="w-full flex fixed top-0 z-50 items-center justify-center py-3 px-5 duration-300 sm:py-5"
      style={{
        backgroundColor,
        color: contrastColor,
      }}
    >
      <div className="max-w-6xl flex flex-row w-full justify-between">
        {/* Logo + Título */}
        <Link href={homeHref}>
          <div className="flex flex-row gap-x-3 items-center cursor-pointer">
            <Avatar>
              <AvatarImage
                src={
                  settings.bannerImage
                    ? useConstructUrl(settings.bannerImage)
                    : ""
                }
              />
              <AvatarFallback>{settings.metaTitle?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <h1 className="text-xl font-bold" style={{ color: contrastColor }}>
              {settings.metaTitle ?? "Minha loja"}
            </h1>
          </div>
        </Link>

        <div className="flex flex-row gap-x-3 items-center">
          {/* Botão Início */}
          <Link className="hidden sm:block" href={homeHref}>
            <Button variant="secondary" className="rounded-full">
              Início
            </Button>
          </Link>

          {/* Botão Sobre Nós */}
          <Link className="hidden sm:block" href={aboutHref}>
            <Button variant="secondary" className="rounded-full">
              Sobre Nós
            </Button>
          </Link>

          {/* Carrinho */}
          {settings.allowOrders && (
            <Popover open={modalIsOpen} onOpenChange={setModalIsOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="rounded-full relative">
                  <Handbag className="size-4" />
                  {cartItems.length > 0 && (
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 text-center text-xs flex items-center justify-center rounded-full">
                      {cartItems.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent
                align="end"
                className="w-80 mt-2 mr-2 rounded-2xl"
              >
                {isEmpty ? (
                  <div className="flex flex-col items-center gap-4 p-4 rounded-2xl">
                    <h1 className="text-center text-lg font-bold">
                      Seu pedido ainda não possui produtos
                    </h1>
                    <p className="text-center text-sm opacity-80">
                      Navegue para adicionar produtos ao seu pedido
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-center gap-x-2">
                      <h1 className="font-bold text-lg">Seu pedido</h1>

                      <span className="text-sm opacity-80">
                        {cartItems.length} itens
                      </span>
                    </div>

                    <div className="flex flex-1 max-h-72">
                      <ScrollArea className="w-full rounded-md">
                        {cartItems.map((item) => (
                          <ItemRequested
                            toggleRemove={toggleProduct}
                            slug={item.slug}
                            key={item.id}
                            id={item.id}
                            organizationId={item.organizationId}
                            thumbnail={
                              item.thumbnail
                                ? useConstructUrl(item.thumbnail)
                                : ""
                            }
                            name={item.name}
                            quantityInit={item.quantity}
                            updateQuantity={updateQuantityCart}
                            contrastColor={contrastColor}
                            salePrice={item.salePrice}
                            quantity={item.quantity}
                          />
                        ))}
                      </ScrollArea>
                    </div>

                    <Link href={cartHref}>
                      <Button
                        className="w-full mt-3"
                        variant={"secondary"}
                        onClick={handleGoToCart}
                      >
                        Finalizar Pedido
                      </Button>
                    </Link>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}
          <Link href={accountHref}>
            <Button variant="secondary" size="icon-sm" className="rounded-full">
              <User />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
