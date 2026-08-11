import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  useUserHasHydrated,
  useUserStore,
} from "../../../../context/catalog/use-cart-session";
import { useCatalogSettings } from "@/features/storefront/hooks/use-catalog-settings";
import {
  deliveryMethodsConfig,
  paymentMethodsConfig,
} from "../../types/payments";
import { useCart } from "@/hooks/use-cart";
import { useQueryProductsOfCart } from "@/features/products/hooks/use-products";

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "558688923098";

export function useCheckoutLogic(subdomain: string) {
  const router = useRouter();
  const [deliveryMethod, setDeliveryMethod] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [address, setAddress] = useState("");
  const [observations, setObservations] = useState("");
  // Guest info — usado só no modo APPROVAL quando o cliente não está logado.
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const { products, clearOrganizationCart } = useCart(subdomain);
  const { user } = useUserStore();
  const { data: catalogSettings } = useCatalogSettings({ subdomain });
  const userHasHydrated = useUserHasHydrated();

  const { data: productsOfCart } = useQueryProductsOfCart({
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
    quantity: findAndConvertQuantity(item.id),
  }));

  const purchase = useMutation(
    orpc.checkout.purchaseAssas.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const kitchenPurchase = useMutation(
    orpc.checkout.kitchenCheckout.mutationOptions({
      onSuccess: () => {
        clearOrganizationCart();
        router.push("/checkout/sucesso");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  // Modo APPROVAL — pedido vai pra fila de aprovação no PDV. Após criar, a
  // tela de sucesso mostra o número do pedido pra o cliente apresentar no
  // caixa (`?pedido=42`).
  const approvalPurchase = useMutation(
    orpc.checkout.approvalCheckout.mutationOptions({
      onSuccess: (data) => {
        clearOrganizationCart();
        router.push(`/checkout/sucesso?pedido=${data.saleNumber}`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const availablePaymentMethods = useMemo(() => {
    return catalogSettings?.paymentMethodSettings.filter(
      (method) => method in paymentMethodsConfig,
    );
  }, [catalogSettings?.paymentMethodSettings]);

  const availableDeliveryMethods = useMemo(() => {
    return catalogSettings?.deliveryMethods.filter(
      (method) => method in deliveryMethodsConfig,
    );
  }, [catalogSettings?.deliveryMethods]);

  const subtotal = productsOfCart?.reduce(
    (sum: number, item) =>
      sum +
      item.salePrice *
        Number(
          products.find((product) => product.productId === item.id)?.quantity,
        ),
    0,
  );

  const totalWeight = products.reduce(
    (sum: number, item) => sum + 2 * Number(item.quantity),
    0,
  );

  const calculateFreight = () => {
    const {
      freightOptions,
      freightChargeType,
      freightFixedValue,
      freightValuePerKg,
      freeShippingEnabled,
      freeShippingMinValue,
    } = catalogSettings || {};

    if (freeShippingEnabled && subtotal >= Number(freeShippingMinValue)) {
      return 0;
    }

    if (freightOptions === "FREE_SHIPPING") {
      return 0;
    }

    if (
      freightOptions === "NO_SHIPPING" ||
      freightOptions === "NEGOTIATE_WHATSAPP"
    ) {
      return 0;
    }

    if (freightChargeType === "FIXED") {
      return Number(freightFixedValue);
    } else if (freightChargeType === "PER_KG") {
      return Number(freightValuePerKg) * totalWeight;
    }

    return 0;
  };

  const freightValue = calculateFreight();
  const total = subtotal + freightValue;

  const isFreeShippingApplied =
    catalogSettings?.freeShippingEnabled &&
    subtotal >= Number(catalogSettings?.freeShippingMinValue) &&
    freightValue === 0;

  useEffect(() => {
    if (
      availablePaymentMethods &&
      availablePaymentMethods.length > 0 &&
      !paymentMethod
    ) {
      setPaymentMethod(availablePaymentMethods[0]);
    }
  }, [availablePaymentMethods, paymentMethod]);

  useEffect(() => {
    if (
      availableDeliveryMethods &&
      availableDeliveryMethods.length > 0 &&
      !deliveryMethod
    ) {
      setDeliveryMethod(availableDeliveryMethods[0]);
    }
  }, [availableDeliveryMethods, deliveryMethod]);

  const getPaymentMethodLabel = (method: string): string => {
    return (
      paymentMethodsConfig[method as keyof typeof paymentMethodsConfig]
        ?.label || method
    );
  };

  const getDeliveryMethodLabel = (method: string): string => {
    return (
      deliveryMethodsConfig[method as keyof typeof deliveryMethodsConfig]
        ?.label || method
    );
  };

  const handleConfirmOrder = () => {
    if (!paymentMethod) {
      toast.error("Por favor, selecione um método de pagamento");
      return;
    }

    if (!deliveryMethod) {
      toast.error("Por favor, selecione um método de entrega");
      return;
    }

    if (deliveryMethod === "DELIVERY_HOME" && !address.trim()) {
      toast.error("Por favor, informe o endereço de entrega");
      return;
    }

    let message = "Olá! Gostaria de fazer um pedido:\n\n";

    message += `*Forma de pagamento:* ${getPaymentMethodLabel(
      paymentMethod,
    )}\n`;
    message += `*Método de entrega:* ${getDeliveryMethodLabel(
      deliveryMethod,
    )}\n`;

    if (deliveryMethod === "DELIVERY_HOME" && address.trim()) {
      message += `*Endereço:* ${address.trim()}\n`;
    }

    if (freightValue > 0) {
      message += `*Valor do frete:* R$ ${freightValue.toFixed(2)}\n`;
    } else if (isFreeShippingApplied) {
      message += `*Frete:* Grátis (pedido acima de R$ ${catalogSettings?.freeShippingMinValue})\n`;
    } else if (
      catalogSettings?.freightOptions === "NEGOTIATE_WHATSAPP" ||
      catalogSettings?.freightOptions === "NEGOTIATE_FREIGHT"
    ) {
      message += `*Frete:* A combinar\n`;
    }

    if (observations.trim()) {
      message += `*Observação:* ${observations.trim()}\n`;
    }

    message += "\n*Produtos:*\n";

    productsOfCart?.forEach((item, index) => {
      const itemTotal = (
        item.salePrice *
        Number(
          products.find((product) => product.productId === item.id)?.quantity,
        )
      ).toFixed(2);
      message += `${index + 1}. ${item.name} ${findAndConvertQuantity(
        item.id,
      )}x - R$ ${itemTotal}\n`;
    });

    message += `\n*Subtotal:* R$ ${subtotal.toFixed(2)}`;
    if (freightValue > 0) {
      message += `\n*Frete:* R$ ${freightValue.toFixed(2)}`;
    }
    message += `\n*TOTAL: R$ ${total.toFixed(2)}*`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    window.open(whatsappURL, "_blank");
    toast.success("Redirecionando para o WhatsApp...");
    setTimeout(() => router.push("/"), 2000);
  };

  const isKitchenMode = catalogSettings?.operationMode === "KITCHEN";
  const isApprovalMode = catalogSettings?.operationMode === "APPROVAL";

  const onCheckout = () => {
    const products = productsOfCart?.map((item) => ({
      id: item.id.toString(),
      quantity: findAndConvertQuantity(item.id),
    }));

    if (isApprovalMode) {
      // Logado → passa customerId; senão exige nome (guest.name é required).
      if (user?.id) {
        approvalPurchase.mutate({
          domain: subdomain,
          products,
          customerId: user.id,
          notes: observations.trim() || undefined,
        });
      } else {
        const name = guestName.trim();
        if (!name) {
          toast.error("Informe seu nome pra a loja te identificar");
          return;
        }
        approvalPurchase.mutate({
          domain: subdomain,
          products,
          guest: {
            name,
            phone: guestPhone.trim() || undefined,
          },
          notes: observations.trim() || undefined,
        });
      }
      return;
    }

    if (isKitchenMode) {
      kitchenPurchase.mutate({
        domain: subdomain,
        products,
        customerId: user?.id || "",
        notes: observations.trim() || undefined,
      });
      return;
    }

    purchase.mutate({
      domain: subdomain,
      products,
      customerId: user?.id || "",
      email: user?.email || "",
    });
  };

  return {
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
    cartItems,
    subtotal,
    freightValue,
    total,
    isFreeShippingApplied,
    catalogSettings,
    handleConfirmOrder,
    onCheckout,
    purchase,
    isKitchenMode,
    isApprovalMode,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    isCheckoutPending:
      purchase.isPending ||
      kitchenPurchase.isPending ||
      approvalPurchase.isPending,
    router,
    userHasHydrated,
    user,
  };
}
