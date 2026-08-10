"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DollarSignIcon,
  PercentIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, User } from "lucide-react";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Label } from "@/components/ui/label";
import type { CartItem, CustomerSales } from ".";
import { FieldError } from "@/components/ui/field";
import type { FieldErrors } from "react-hook-form";
import type { SaleFormData } from "./schema";

interface CartSaleProps {
  orgLogo?: string | null;
  orgName?: string | null;
  cartItems: CartItem[];
  clearCart: () => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItemQuantity: (id: string, quantity: number) => void;
  // Venda ágil: quando muda, foca+seleciona a quantidade deste item (o `nonce`
  // permite re-focar o mesmo item ao adicioná-lo em sequência).
  focusItem?: { id: string; nonce: number } | null;
  // Enter/Esc na quantidade — devolve o foco pro campo de busca.
  onQuantityCommit?: () => void;
  // Quando a org exige autorização, o input livre de quantidade é bloqueado:
  // reduzir só pelo botão "−" (que passa pela autorização), evitando o bypass
  // de digitar um número menor.
  lockQuantityInput?: boolean;
  customer?: CustomerSales | null;
  setCustomerDialogOpen: (open: boolean) => void;
  discount: number;
  setDiscount: (discount: number) => void;
  subtotal: number;
  total: number;
  setPaymentDialogOpen: (open: boolean) => void;
  discountType: "percent" | "value";
  setDiscountType: (discountType: "percent" | "value") => void;
  error?: FieldErrors<SaleFormData>;
}

export function CartSale({
  orgLogo,
  orgName,
  cartItems,
  clearCart,
  removeItem,
  updateQuantity,
  setItemQuantity,
  focusItem,
  onQuantityCommit,
  lockQuantityInput,
  customer,
  setCustomerDialogOpen,
  discount,
  setDiscount,
  subtotal,
  total,
  setPaymentDialogOpen,
  discountType,
  setDiscountType,
  error,
}: CartSaleProps) {
  const discountAmount =
    discountType === "percent" ? (subtotal * discount) / 100 : discount;

  // Foco na quantidade quando um item ganha `focusItem`. Precisa ROUBAR o foco
  // do useEffect da busca (que faz setTimeout 50ms ao montar/fechar dialogs):
  // agendamos 100ms — depois do refoco automático da busca — e persistimos o
  // foco por um segundo tick, garantindo que ninguém rouba de volta.
  const quantityRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  useEffect(() => {
    if (!focusItem) return;
    const focusNow = () => {
      const input = quantityRefs.current.get(focusItem.id);
      if (input) {
        input.focus();
        input.select();
      }
    };
    const t1 = setTimeout(focusNow, 100);
    const t2 = setTimeout(focusNow, 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [focusItem]);

  return (
    <div className="space-y-4">
      {/* Painel do carrinho no estilo cupom fiscal: fundo branco (destaca do
          cinza da tela) com a borda inferior picotada. */}
      <Card className="receipt-edge rounded-b-none border-0 bg-card pb-6 shadow-sm">
        <CardHeader className="pb-3">
          {/* Cabeçalho do "cupom": logo da loja à esquerda, Limpar à direita. */}
          <div className="flex items-center justify-between gap-2">
            {orgLogo ? (
              // biome-ignore lint/performance/noImgElement: logo da org via URL do S3
              <img
                src={orgLogo}
                alt={orgName ?? "Logo"}
                className="h-11 max-w-[60%] object-contain object-left"
              />
            ) : (
              <span className="text-lg font-bold">{orgName ?? "Carrinho"}</span>
            )}
            {cartItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ShoppingCartIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Carrinho vazio</p>
              <p className="text-xs text-muted-foreground mt-1">
                Busque produtos ou use o leitor de código de barras
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[280px] pr-4">
                <div className="space-y-3">
                  {cartItems.map((item) =>
                    item.cancelled ? (
                      // Item cancelado por autorização: fica RISCADO como rastro,
                      // sem controles e fora do total.
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border border-dashed p-3 opacity-70"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate line-through">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground line-through">
                            {currencyFormatter(item.price)} x {item.quantity}
                          </div>
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                            Cancelado
                          </div>
                        </div>
                        <div className="font-semibold text-sm text-muted-foreground line-through">
                          {currencyFormatter(item.price * item.quantity)}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {currencyFormatter(item.price)} x {item.quantity}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              ref={(el) => {
                                quantityRefs.current.set(item.id, el);
                              }}
                              type="number"
                              max={Number(item.currentStock)}
                              value={item.quantity}
                              readOnly={lockQuantityInput}
                              onFocus={(e) => e.currentTarget.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  e.preventDefault();
                                  onQuantityCommit?.();
                                }
                              }}
                              onChange={(e) => {
                                if (lockQuantityInput) return;
                                setItemQuantity(
                                  item.id,
                                  Number(e.target.value),
                                );
                              }}
                              className="h-7 w-12 text-center p-0"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 bg-transparent"
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={
                                item.quantity >= Number(item.currentStock)
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="font-semibold text-sm">
                            {currencyFormatter(item.price * item.quantity)}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </ScrollArea>

              <Separator />

              {/* Customer */}
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent"
                onClick={() => setCustomerDialogOpen(true)}
              >
                <User className="h-4 w-4 mr-2" />
                {customer ? (
                  <span className="truncate">{customer.name}</span>
                ) : (
                  <span className="text-muted-foreground">
                    Adicionar cliente
                  </span>
                )}
              </Button>

              {/* Discount */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Desconto</Label>
                  <div className="flex mt-1">
                    <Input
                      type="number"
                      min="0"
                      max={discountType === "percent" ? 100 : subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="rounded-r-none"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-l-none border-l-0 bg-transparent"
                      onClick={() =>
                        setDiscountType(
                          discountType === "percent" ? "value" : "percent",
                        )
                      }
                    >
                      {discountType === "percent" ? (
                        <PercentIcon className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-medium">R$</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {currencyFormatter(subtotal)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>
                      Desconto{" "}
                      {discountType === "percent" ? `(${discount}%)` : ""}
                    </span>
                    <span>- {currencyFormatter(discountAmount)}</span>
                  </div>
                )}
                {error?.discount && (
                  <FieldError>{error.discount.message}</FieldError>
                )}

                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary">
                    {currencyFormatter(total)}
                  </span>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => setPaymentDialogOpen(true)}
                disabled={cartItems.every((item) => item.cancelled)}
              >
                <DollarSignIcon className="h-5 w-5 mr-2" />
                Finalizar Venda
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
