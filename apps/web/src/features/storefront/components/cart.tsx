"use client";

import { ArrowLeft, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useUserStore } from "../../../context/catalog/use-cart-session";
import { useConstructUrl } from "@/hooks/use-construct-url";
import placeholder from "@/assets/background-default-image.svg";
import { useCart } from "@/hooks/use-cart";
import { useQueryProductsOfCart } from "@/features/products/hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalogSettings } from "@/features/storefront/hooks/use-catalog-settings";

interface CartProps {
  subdomain: string;
}

export function Cart({ subdomain }: CartProps) {
  const { user } = useUserStore();
  const { products, updateQuantity, toggleProduct } = useCart(subdomain);
  const { data: catalogSettings } = useCatalogSettings({ subdomain });
  // Modo APPROVAL: cliente paga presencial → não faz sentido exigir login.
  // Vai direto pro /checkout, que aceita nome + telefone quando não logado.
  const isApprovalMode = catalogSettings?.operationMode === "APPROVAL";

  const { data: productsOfCart, isLoading } = useQueryProductsOfCart({
    subdomain,
    productIds: products.map((product) => product.productId),
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
    quantity: findAndConvertQuantity(item.id),
  }));

  const router = useRouter();

  const handleUpdateQuantity = (cartId: string, newQuantity: number) => {
    updateQuantity(cartId, subdomain, newQuantity.toString());
  };

  const handleRemoveItem = (cartId: string) => {
    toggleProduct(cartId, subdomain);
  };

  const total = cartItems.reduce(
    (sum: number, item) => sum + item.salePrice * item.quantity,
    0
  );

  function handlerCheckout() {
    // Modo aprovação presencial: dispensa login (o checkout coleta nome +
    // telefone). Nos demais modos, mantém o gate de login.
    if (!user && !isApprovalMode) {
      router.push("/sign-in");
      return;
    }
    router.push("checkout");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar às compras
        </Button>

        <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg" />

                      <div className="flex-1">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24 mt-1" />
                      </div>

                      <div className="flex flex-col items-end justify-between gap-y-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-24 mt-1" />
                        <Skeleton className="h-4 w-24 mt-1" />
                      </div>

                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 sm:h-8 sm:w-8"></Skeleton>
                        <Skeleton className="w-8 text-center font-medium" />
                        <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 "></Skeleton>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">Resumo do Pedido</h2>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                  </div>

                  <Skeleton className="w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!isLoading && cartItems.length === 0 && (
          <Card className="p-8 text-center">
            <p className="h-6 w-64 text-lg">Seu carrinho está vazio</p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              Começar a comprar
            </Button>
          </Card>
        )}

        {!isLoading && cartItems.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <img
                        src={
                          item.thumbnail
                            ? useConstructUrl(item.thumbnail)
                            : placeholder
                        }
                        alt={item.name}
                        className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg"
                      />

                      <div className="flex-1">
                        <h3 className="font-semibold text-md sm:text-lg">
                          {item.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.quantity} Unidades
                        </p>
                      </div>

                      <div className="flex flex-col items-end justify-between gap-y-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="group"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            disabled={item.quantity === 1}
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 sm:h-8 sm:w-8"
                            onClick={() =>
                              handleUpdateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 sm:h-8 sm:w-8 "
                            onClick={() =>
                              handleUpdateQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>

                        <p className="text-lg font-bold">
                          R${currencyFormatter(item.salePrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">Resumo do Pedido</h2>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium ">
                        R${currencyFormatter(total)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="bg-gradient-primary bg-clip-text">
                      R${currencyFormatter(total)}
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => handlerCheckout()}
                  >
                    {isApprovalMode
                      ? "Enviar pedido para a loja"
                      : !user
                        ? "Faça Login"
                        : "Finalizar Pedido"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
