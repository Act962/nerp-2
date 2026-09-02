"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DollarSignIcon, PercentIcon, ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Trash2, User, X } from "lucide-react";
import { currencyFormatter } from "@/utils/currency-formatter";
import { Label } from "@/components/ui/label";
import { unitAllowsDecimal, unitLabel } from "@/features/products/lib/units";
import type { CartItem, CustomerSales } from ".";
import { FieldError } from "@/components/ui/field";
import type { FieldErrors } from "react-hook-form";
import type { SaleFormData } from "./schema";

// Etiqueta sutil do atalho (ex.: "Alt+C"). Font-mono pequena, cinza claro —
// dá visibilidade sem competir com o rótulo principal do botão.
function ShortcutHint({ keys }: { keys?: string | null }) {
  if (!keys) return null;
  return (
    <kbd className="ml-auto rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-normal text-muted-foreground">
      {keys}
    </kbd>
  );
}

interface CartSaleProps {
  orgLogo?: string | null;
  orgName?: string | null;
  cartItems: CartItem[];
  clearCart: () => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItemQuantity: (id: string, quantity: number) => void;
  setItemPrice: (id: string, price: number) => void;
  focusItem?: { id: string; nonce: number } | null;
  onQuantityCommit?: () => void;
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
  shortcuts?: {
    selectCustomer?: string;
    clearCart?: string;
    finishSale?: string;
  };
}

// Layout inspirado no PDV do Olist ERP: cada linha do carrinho é uma linha
// tabular (Nome · Qtd · Preço un · Total · X). Sem foto no carrinho — a
// foto já aparece na grade de produtos. Fontes maiores pra legibilidade
// (padrão de ERPs). Cliente vira chip discreto no rodapé, acima do total.
export function CartSale({
  orgLogo,
  orgName,
  cartItems,
  clearCart,
  removeItem,
  updateQuantity: _updateQuantity,
  setItemQuantity,
  setItemPrice,
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
  shortcuts,
}: CartSaleProps) {
  const discountAmount =
    discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const activeItems = cartItems.filter((item) => !item.cancelled);
  const totalUnits = activeItems.reduce((sum, item) => sum + item.quantity, 0);

  // Foco na quantidade quando um item ganha `focusItem`.
  const quantityRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const priceRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
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
    // Altura total do carrinho ocupa a coluna do grid. A lista de itens
    // rola internamente; o rodapé (cliente/desconto/total/finalizar) fica
    // fixo — o botão "Finalizar Venda" precisa estar SEMPRE visível.
    <div className="flex h-full min-h-0 flex-col">
      <Card className="receipt-edge flex h-full min-h-0 flex-col rounded-b-none border-0 bg-card pb-4 shadow-sm">
        <CardHeader className="pb-2">
          {/* Cliente ocupa o topo do carrinho (antes ficava embaixo). A logo
              da org foi pro app-header — economiza altura vertical pra a
              lista de itens caber mais linhas. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomerDialogOpen(true)}
              className="flex flex-1 items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {customer ? customer.name : "Consumidor final"}
              </span>
              <ShortcutHint keys={shortcuts?.selectCustomer} />
            </button>
            {cartItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar
                <ShortcutHint keys={shortcuts?.clearCart} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <ShoppingCartIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-base font-medium">Carrinho vazio</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Busque produtos ou use o leitor de código de barras
              </p>
            </div>
          ) : (
            <>
              {/* Cabeçalho da tabela — colunas do cupom fiscal do Olist. */}
              <div className="grid grid-cols-[1fr_128px_112px_112px_28px] items-center gap-3 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Descrição</span>
                <span className="text-center">Quant.</span>
                <span className="text-right">Preço un</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {/* Lista tabular, uma linha por item — SÓ ela rola. O rodapé
                  do carrinho (cliente/desconto/total/finalizar) fica fixo
                  fora do ScrollArea. */}
              <ScrollArea className="min-h-0 flex-1 pr-3">
                <ul className="divide-y">
                  {cartItems.map((item) =>
                    item.cancelled ? (
                      <li
                        key={item.id}
                        className="grid grid-cols-[1fr_128px_112px_112px_28px] items-center gap-3 py-2.5 opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-medium line-through">
                            {item.name}
                          </div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
                            Cancelado
                          </div>
                        </div>
                        <div className="text-center text-[15px] line-through">
                          {item.quantity} {unitLabel(item.unit)}
                        </div>
                        <div className="text-right text-[15px] line-through">
                          {currencyFormatter(item.price)}
                        </div>
                        <div className="text-right text-[15px] font-semibold text-muted-foreground line-through">
                          {currencyFormatter(item.price * item.quantity)}
                        </div>
                        <div />
                      </li>
                    ) : (
                      <li
                        key={item.id}
                        className="grid grid-cols-[1fr_128px_112px_112px_28px] items-center gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-medium leading-tight">
                            {item.name}
                          </div>
                          {item.sku && (
                            <div className="truncate text-[12px] text-muted-foreground">
                              {item.sku}
                            </div>
                          )}
                          {item.trackStock !== false &&
                            item.quantity > Number(item.currentStock) && (
                              <div className="text-[12px] font-medium text-amber-600">
                                acima do estoque ({item.currentStock})
                              </div>
                            )}
                        </div>

                        <div className="flex items-center justify-center gap-1">
                          <Input
                            ref={(el) => {
                              quantityRefs.current.set(item.id, el);
                            }}
                            type="number"
                            min={0}
                            step={unitAllowsDecimal(item.unit) ? "0.001" : "1"}
                            // SEM `max`. Ele valia `currentStock`, e como a
                            // linha entra no carrinho já com quantidade 1, a
                            // seta pra cima morria de imediato em todo produto
                            // com estoque 1 — e o navegador ainda recusava a
                            // quantidade digitada. Estoque estourado agora
                            // AVISA (abaixo) em vez de travar em silêncio.
                            value={item.quantity}
                            onFocus={(e) => e.currentTarget.select()}
                            // O input NÃO é bloqueado quando requireCancelAuth
                            // é true — o gate de autorização acontece via
                            // botão "−" no fluxo antigo. Sem isso, o foco
                            // automático (venda ágil) também fica travado.
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                e.preventDefault();
                                onQuantityCommit?.();
                              } else if (e.key === "Tab" && !e.shiftKey) {
                                const priceInput = priceRefs.current.get(
                                  item.id,
                                );
                                if (priceInput) {
                                  e.preventDefault();
                                  priceInput.focus();
                                  priceInput.select();
                                }
                              }
                            }}
                            onChange={(e) =>
                              setItemQuantity(item.id, Number(e.target.value))
                            }
                            onBlur={(e) => {
                              if (Number(e.target.value) <= 0)
                                setItemQuantity(item.id, 1);
                            }}
                            className="h-8 w-16 text-center text-[15px]"
                          />
                          <span className="text-[12px] text-muted-foreground">
                            {unitLabel(item.unit)}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[13px] text-muted-foreground">
                            R$
                          </span>
                          <Input
                            ref={(el) => {
                              priceRefs.current.set(item.id, el);
                            }}
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              setItemPrice(item.id, Number(e.target.value))
                            }
                            onFocus={(e) => e.currentTarget.select()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                e.preventDefault();
                                onQuantityCommit?.();
                              }
                            }}
                            className="h-8 w-20 px-1 text-right text-[15px]"
                          />
                        </div>

                        <div className="text-right text-[15px] font-semibold tabular-nums">
                          {currencyFormatter(item.price * item.quantity)}
                        </div>

                        <div className="flex justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.id)}
                            aria-label="Remover item"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </ScrollArea>

              <Separator />

              {/* Rodapé fixo estilo Olist:
                    [X itens / Y unidades]     [− desconto] [TOTAL R$ 0,00]
                  Desconto vira input compacto colado à esquerda do total —
                  ganha uma linha vertical inteira comparado à antiga linha
                  dedicada. */}
              <div className="flex items-end justify-between gap-3">
                <div className="text-[13px] leading-tight text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">
                      {activeItems.length}
                    </span>{" "}
                    {activeItems.length === 1 ? "item" : "itens"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      {totalUnits}
                    </span>{" "}
                    {totalUnits === 1 ? "unidade" : "unidades"}
                  </div>
                  {error?.discount && (
                    <FieldError className="mt-1">
                      {error.discount.message}
                    </FieldError>
                  )}
                </div>

                {/* Desconto colado à esquerda do TOTAL — input pequeno com
                    toggle % / R$. Valor calculado aparece embaixo em verde
                    quando > 0. */}
                <div className="ml-auto flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Desc.
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={discountType === "percent" ? 100 : subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="h-8 w-16 rounded-r-none px-1 text-right text-[13px]"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-l-none border-l-0 bg-transparent"
                      onClick={() =>
                        setDiscountType(
                          discountType === "percent" ? "value" : "percent",
                        )
                      }
                    >
                      {discountType === "percent" ? (
                        <PercentIcon className="h-3.5 w-3.5" />
                      ) : (
                        <span className="text-[11px] font-medium">R$</span>
                      )}
                    </Button>
                  </div>
                  {discount > 0 && (
                    <div className="text-[11px] text-success">
                      −{currencyFormatter(discountAmount)}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Total
                  </div>
                  <div className="text-3xl font-bold tabular-nums text-primary">
                    R$ {currencyFormatter(total)}
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                className="h-14 w-full text-lg font-semibold"
                onClick={() => setPaymentDialogOpen(true)}
                disabled={activeItems.length === 0}
              >
                <DollarSignIcon className="mr-2 h-6 w-6" />
                Finalizar Venda
                <ShortcutHint keys={shortcuts?.finishSale} />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
