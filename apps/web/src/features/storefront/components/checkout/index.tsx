"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeliveryMethodCard } from "./delivery-method-card";
import { PaymentMethodCard } from "./payment-method-card";
import { ObservationsCard } from "./observations-card";
import { OrderSummaryCard } from "./order-summary-card";
import { useCheckoutLogic } from "./use-checkout-logic";
import { redirect } from "next/navigation";
import { useCheckoutStates } from "@/features/checkout/hooks/use-checkout-states";
import { useEffect } from "react";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";

interface CheckoutProps {
  subdomain: string;
}

export function CheckoutPage({ subdomain }: CheckoutProps) {
  const {
    deliveryMethod,
    setDeliveryMethod,
    paymentMethod,
    setPaymentMethod,
    address,
    setAddress,
    observations,
    setObservations,
    availablePaymentMethods,
    availableDeliveryMethods,
    subtotal,
    freightValue,
    total,
    isFreeShippingApplied,
    catalogSettings,
    onCheckout,
    isCheckoutPending,
    router,
    cartItems,
    user,
    userHasHydrated,
    isApprovalMode,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
  } = useCheckoutLogic(subdomain);

  // Modo APPROVAL dispensa login (paga presencial). Nos demais modos, redireciona
  // pra cadastro quando anônimo.
  if (!user && userHasHydrated && !isApprovalMode) {
    redirect("/sign-up");
  }

  const [checkoutStates, setCheckoutStates] = useCheckoutStates();

  const { clearOrganizationCart } = useCart(subdomain);

  useEffect(() => {
    if (checkoutStates.success) {
      clearOrganizationCart();
      router.push("/");
    }
  }, [checkoutStates.success]);

  useEffect(() => {
    if (checkoutStates.cancel) {
      toast.error("Pedido cancelado");
    }
  }, [checkoutStates.cancel]);

  return (
    <div className="mx-auto w-full px-5 max-w-6xl py-4">
      <Button
        onClick={() => router.push("/cart")}
        variant={"secondary"}
        className="mb-4"
      >
        <ArrowLeft className="size-4" /> Voltar ao carrinho
      </Button>

      <h1 className="text-3xl font-bold mb-8">Finalizar Pedido</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {isApprovalMode && !user && (
            <Card>
              <CardHeader>
                <CardTitle>Seus dados</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Precisamos do seu nome pra identificar o pedido quando você
                  chegar na loja. Telefone é opcional (usado só se
                  precisarmos falar com você).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guest-name">Nome</Label>
                  <Input
                    id="guest-name"
                    placeholder="Ex.: Maria Silva"
                    value={guestName ?? ""}
                    onChange={(e) => setGuestName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone">Telefone (opcional)</Label>
                  <Input
                    id="guest-phone"
                    placeholder="(00) 00000-0000"
                    value={guestPhone ?? ""}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </CardContent>
            </Card>
          )}
          <DeliveryMethodCard
            availableDeliveryMethods={availableDeliveryMethods}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            address={address}
            onAddressChange={setAddress}
            deliverySpecialInfo={catalogSettings?.deliverySpecialInfo}
          />

          <PaymentMethodCard
            availablePaymentMethods={availablePaymentMethods}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />

          <ObservationsCard
            observations={observations}
            onObservationsChange={setObservations}
          />
        </div>

        <div className="lg:col-span-1">
          <OrderSummaryCard
            cartItems={cartItems}
            subtotal={subtotal}
            freightValue={freightValue}
            total={total}
            isFreeShippingApplied={isFreeShippingApplied}
            freeShippingEnabled={catalogSettings?.freeShippingEnabled}
            freeShippingMinValue={catalogSettings?.freeShippingMinValue}
            onConfirm={onCheckout}
            isLoading={isCheckoutPending}
            isDisabled={
              availablePaymentMethods?.length === 0 ||
              availableDeliveryMethods?.length === 0
            }
          />
        </div>
      </div>
    </div>
  );
}
