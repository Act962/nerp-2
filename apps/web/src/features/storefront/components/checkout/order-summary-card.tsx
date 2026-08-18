"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currencyFormatter } from "@/utils/currency-formatter";
import { useCheckoutStates } from "@/features/checkout/hooks/use-checkout-states";
import { FieldError } from "@/components/ui/field";
import { CircleXIcon } from "lucide-react";

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  salePrice: number;
}

interface OrderSummaryCardProps {
  cartItems: CartItem[];
  subtotal: number;
  freightValue: number;
  total: number;
  isFreeShippingApplied: boolean | undefined;
  freeShippingEnabled?: boolean;
  freeShippingMinValue?: number;
  onConfirm: () => void;
  isLoading: boolean;
  isDisabled: boolean;
}

export function OrderSummaryCard({
  cartItems,
  subtotal,
  freightValue,
  total,
  isFreeShippingApplied,
  freeShippingEnabled,
  freeShippingMinValue,
  onConfirm,
  isLoading,
  isDisabled,
}: OrderSummaryCardProps) {
  const remainingForFreeShipping =
    freeShippingEnabled &&
    !isFreeShippingApplied &&
    freeShippingMinValue &&
    subtotal < Number(freeShippingMinValue)
      ? Number(freeShippingMinValue) - subtotal
      : 0;

  const [checkoutStates, setCheckoutStates] = useCheckoutStates();

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <CardTitle>Resumo do Pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {cartItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}x {item.name}
              </span>
              <span className="font-medium">
                R$ {currencyFormatter(item.salePrice * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">
              R$ {currencyFormatter(subtotal)}
            </span>
          </div>

          {freightValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frete</span>
              <span className="font-medium">
                R$ {currencyFormatter(freightValue)}
              </span>
            </div>
          )}

          {isFreeShippingApplied && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frete</span>
              <span className="font-medium text-green-600">Grátis</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="bg-gradient-primary bg-clip-text">
              R$ {currencyFormatter(total)}
            </span>
          </div>

          {remainingForFreeShipping > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Faltam R$ {currencyFormatter(remainingForFreeShipping)} para frete
              grátis
            </p>
          )}
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={onConfirm}
          disabled={isDisabled || isLoading}
        >
          Confirmar Pedido
        </Button>
        {checkoutStates.cancel && (
          <div className="flex items-center justify-center gap-2 bg-red-200 rounded-sm p-2 text-red-600">
            <CircleXIcon className="size-4" />
            <FieldError>O pedido foi cancelado</FieldError>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
