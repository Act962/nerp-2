"use client";

import {
  Handbag,
  House,
  LayoutGrid,
  MenuIcon,
  Search,
  Store,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { type FormEvent, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryProductsOfCart } from "@/features/products/hooks/use-products";
import { useQueryCatalogProducts } from "@/features/storefront/hooks/use-catalog-products";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import {
  TEMA_PADRAO_CATALOGO,
  contraste,
  isHexValido,
  tintaSobre,
} from "@/features/storefront/lib/cores";
import type { OfertaDaVitrine } from "@/features/storefront/server/ofertas";
import { useCart } from "@/hooks/use-cart";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { currencyFormatter } from "@/utils/currency-formatter";
import { BotaoDeOfertas } from "../botao-de-ofertas";
import { ItemRequested } from "./item-requested";

interface Settings {
  metaTitle: string | null;
  theme: string | null;
  headerColor: string | null;
  organizationId: string;
  bannerImage: string | null;
  subdomain: string;
  allowOrders: boolean;
  /** Catálogo sem preço: o pedido vira orçamento e o total some. */
  showPrices: boolean;
  ofertas: OfertaDaVitrine[];
}

interface HeaderProps {
  settings: Settings;
}

/**
 * O cabeçalho da vitrine: barra clara com busca no centro e, embaixo, a
 * navegação com a cor do tema. No celular a navegação desce para uma barra
 * fixa no rodapé, que é onde o polegar alcança.
 */
export function Header({ settings }: HeaderProps) {
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const { products, updateQuantity, toggleProduct } = useCart(
    settings.subdomain,
  );
  const homeHref = useCatalogHref("/");
  const aboutHref = useCatalogHref("/sobre-nos");
  const cartHref = useCatalogHref("/cart");
  const accountHref = useCatalogHref("/account");
  const pathname = usePathname();
  const router = useRouter();
  const naInicial = pathname === homeHref || pathname === `${homeHref}/`;

  const tema = isHexValido(settings.theme)
    ? settings.theme
    : TEMA_PADRAO_CATALOGO;
  const tintaDoTema = tintaSobre(tema);

  /*
    Cabeçalho com cor própria: o texto vem de `tintaSobre`, e os tons de
    hover/borda saem de `currentColor` — assim funcionam sobre qualquer fundo
    sem uma segunda paleta. Sem cor, vale o neutro do tema do app.
  */
  const cabecalho = isHexValido(settings.headerColor)
    ? settings.headerColor
    : null;
  const estiloDoCabecalho = cabecalho
    ? { backgroundColor: cabecalho, color: tintaSobre(cabecalho) }
    : undefined;
  // Tema igual (ou quase) ao cabeçalho sumiria nele: o botão inverte.
  const botaoDoTema =
    cabecalho && contraste(tema, cabecalho) < 1.6
      ? { backgroundColor: tintaSobre(cabecalho), color: cabecalho }
      : { backgroundColor: tema, color: tintaDoTema };

  const [busca, setBusca] = useQueryState("q", { defaultValue: "" });
  const [, setCategorias] = useQueryState("categories");

  const { data: catalogo } = useQueryCatalogProducts({
    subdomain: settings.subdomain,
  });
  const categorias = (catalogo?.categories ?? [])
    .filter((c) => !c.parentId && c.isActive && c.productCount > 0)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const { data: productsOfCart } = useQueryProductsOfCart({
    subdomain: settings.subdomain,
    productIds: products.map((product) => product.productId) || [],
  });

  const quantidadeDe = (productId: string) =>
    Number(
      products.find((product) => product.productId === productId)?.quantity ??
        0,
    );

  const itens = (productsOfCart ?? []).map((item) => ({
    ...item,
    quantity: quantidadeDe(item.id),
  }));
  const total = itens.reduce(
    (soma, item) => soma + item.salePrice * item.quantity,
    0,
  );

  // Fora da inicial a busca leva para ela: é lá que a lista de produtos está.
  const buscar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!naInicial) {
      router.push(
        busca ? `${homeHref}?q=${encodeURIComponent(busca)}` : homeHref,
      );
    }
  };

  const verCategoria = (slug: string) => {
    if (naInicial) {
      setCategorias(slug);
      document
        .getElementById("produtos")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`${homeHref}?categories=${encodeURIComponent(slug)}`);
    }
  };

  const campoDeBusca = (
    <form onSubmit={buscar} className="relative w-full">
      <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
      <input
        type="search"
        value={busca}
        onChange={(evento) => setBusca(evento.target.value || null)}
        placeholder="O que você procura?"
        aria-label="Buscar produtos"
        className={
          cabecalho
            ? "h-11 w-full rounded-full border border-transparent bg-white pr-4 pl-10 text-neutral-900 text-sm shadow-xs outline-none placeholder:text-neutral-500"
            : "h-11 w-full rounded-full border bg-muted/60 pr-4 pl-10 text-sm outline-none transition-colors focus:border-foreground/30 focus:bg-background"
        }
      />
    </form>
  );

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b shadow-xs",
          cabecalho ? "border-current/10" : "bg-card text-card-foreground",
        )}
        style={estiloDoCabecalho}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-8 sm:py-4">
          <Link
            href={homeHref}
            className="flex min-w-0 shrink-0 items-center gap-2.5"
          >
            <Avatar className="size-9 sm:size-10">
              <AvatarImage
                src={
                  settings.bannerImage ? constructUrl(settings.bannerImage) : ""
                }
              />
              <AvatarFallback
                style={{ backgroundColor: tema, color: tintaDoTema }}
              >
                {settings.metaTitle?.slice(0, 2) ?? <Store />}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-bold text-lg sm:text-xl">
              {settings.metaTitle ?? "Minha loja"}
            </span>
          </Link>

          <div className="hidden max-w-xl flex-1 sm:block">{campoDeBusca}</div>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Link
              href={accountHref}
              aria-label="Minha conta"
              className="hidden size-10 items-center justify-center rounded-full hover:bg-current/10 sm:flex"
            >
              <User className="size-5" />
            </Link>

            {settings.allowOrders && (
              <Popover open={carrinhoAberto} onOpenChange={setCarrinhoAberto}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 hover:bg-current/10 sm:pr-3"
                    aria-label="Abrir pedido"
                  >
                    <span className="relative flex size-10 items-center justify-center">
                      <Handbag className="size-5" />
                      {itens.length > 0 && (
                        <span
                          className="absolute top-0.5 right-0.5 flex size-4.5 items-center justify-center rounded-full font-semibold text-[10px]"
                          style={{ backgroundColor: tema, color: tintaDoTema }}
                        >
                          {itens.length}
                        </span>
                      )}
                    </span>
                    <span className="hidden flex-col items-start leading-tight sm:flex">
                      <span className="text-xs opacity-70">
                        {settings.showPrices ? "Seu pedido" : "Seu orçamento"}
                      </span>
                      <span className="font-semibold text-sm">
                        {settings.showPrices
                          ? `R$ ${currencyFormatter(total)}`
                          : `${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                      </span>
                    </span>
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  className="mt-2 w-80 rounded-2xl p-0"
                >
                  {itens.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-6 text-center">
                      <p className="font-semibold">Seu pedido está vazio</p>
                      <p className="text-muted-foreground text-sm">
                        Navegue pela loja e adicione produtos.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 p-4">
                      <p className="font-semibold">
                        Seu pedido{" "}
                        <span className="font-normal text-muted-foreground text-sm">
                          · {itens.length} itens
                        </span>
                      </p>
                      <ScrollArea className="max-h-72">
                        {itens.map((item) => (
                          <ItemRequested
                            key={item.id}
                            toggleRemove={toggleProduct}
                            slug={item.slug}
                            id={item.id}
                            organizationId={item.organizationId}
                            thumbnail={
                              item.thumbnail ? constructUrl(item.thumbnail) : ""
                            }
                            name={item.name}
                            quantityInit={item.quantity}
                            updateQuantity={(productId, quantidade) =>
                              updateQuantity(
                                productId,
                                settings.subdomain,
                                quantidade,
                              )
                            }
                            contrastColor="inherit"
                            salePrice={item.salePrice}
                            quantity={item.quantity}
                          />
                        ))}
                      </ScrollArea>
                      {settings.showPrices ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold">
                            R$ {currencyFormatter(total)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          A loja combina os valores com você depois do pedido.
                        </p>
                      )}
                      <Button
                        asChild
                        className="w-full"
                        style={{ backgroundColor: tema, color: tintaDoTema }}
                        onClick={() => setCarrinhoAberto(false)}
                      >
                        <Link href={cartHref}>
                          {settings.showPrices
                            ? "Finalizar pedido"
                            : "Pedir orçamento"}
                        </Link>
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="px-4 pb-3 sm:hidden">{campoDeBusca}</div>

        <nav className="hidden border-current/10 border-t sm:block">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-md px-4 font-semibold text-sm"
                  style={botaoDoTema}
                >
                  <MenuIcon className="size-4" />
                  Categorias
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-96 w-60">
                {categorias.length === 0 && (
                  <DropdownMenuItem disabled>
                    Nenhuma categoria
                  </DropdownMenuItem>
                )}
                {categorias.map((categoria) => (
                  <DropdownMenuItem
                    key={categoria.id}
                    onSelect={() => verCategoria(categoria.slug)}
                  >
                    {categoria.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href={homeHref}
              className="rounded-md px-3 py-2 font-medium text-sm hover:bg-current/10"
            >
              Início
            </Link>
            <Link
              href={aboutHref}
              className="rounded-md px-3 py-2 font-medium text-sm hover:bg-current/10"
            >
              Sobre nós
            </Link>

            <div className="ml-auto">
              <BotaoDeOfertas ofertas={settings.ofertas} tema={tema} />
            </div>
          </div>
        </nav>
      </header>

      <BarraInferior
        tema={tema}
        tintaDoTema={tintaDoTema}
        homeHref={homeHref}
        aboutHref={aboutHref}
        cartHref={cartHref}
        accountHref={accountHref}
        pathname={pathname}
        allowOrders={settings.allowOrders}
        itensNoCarrinho={itens.length}
        ofertas={settings.ofertas}
      />
    </>
  );
}

function BarraInferior({
  tema,
  tintaDoTema,
  homeHref,
  aboutHref,
  cartHref,
  accountHref,
  pathname,
  allowOrders,
  itensNoCarrinho,
  ofertas,
}: {
  tema: string;
  tintaDoTema: string;
  homeHref: string;
  aboutHref: string;
  cartHref: string;
  accountHref: string;
  pathname: string;
  allowOrders: boolean;
  itensNoCarrinho: number;
  ofertas: OfertaDaVitrine[];
}) {
  const ativo = (href: string) =>
    pathname === href || (href === homeHref && pathname === `${homeHref}/`);
  const categoriasHref = `${homeHref}#categorias`;

  const item = (
    href: string,
    rotulo: string,
    Icone: typeof House,
    destaque = false,
  ) => (
    <Link
      href={href}
      aria-label={rotulo}
      className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px]"
    >
      {destaque ? (
        <span
          className="-mt-6 relative flex size-13 items-center justify-center rounded-full shadow-lg ring-4 ring-card"
          style={{ backgroundColor: tema, color: tintaDoTema }}
        >
          <Icone className="size-5" />
          {itensNoCarrinho > 0 && (
            <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-full bg-card font-bold text-[10px] text-card-foreground">
              {itensNoCarrinho}
            </span>
          )}
        </span>
      ) : (
        <Icone
          className="size-5"
          style={ativo(href) ? { color: tema } : undefined}
        />
      )}
      <span className={ativo(href) ? "font-semibold" : "text-muted-foreground"}>
        {rotulo}
      </span>
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-end border-t bg-card px-2 pb-[max(env(safe-area-inset-bottom),0.25rem)] text-card-foreground shadow-[0_-4px_16px_rgb(0_0_0/0.06)] sm:hidden">
      {item(homeHref, "Início", House)}
      {item(categoriasHref, "Categorias", LayoutGrid)}
      {allowOrders
        ? item(cartHref, "Pedido", Handbag, true)
        : item(aboutHref, "Sobre", Store)}
      {ofertas.length > 0 ? (
        <div className="flex flex-1 justify-center">
          <BotaoDeOfertas ofertas={ofertas} tema={tema} compacto />
        </div>
      ) : (
        allowOrders && item(aboutHref, "Sobre", Store)
      )}
      {item(accountHref, "Conta", User)}
    </nav>
  );
}
