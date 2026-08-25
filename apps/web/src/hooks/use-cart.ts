import { useCartSessionStore } from "@/context/catalog/use-cart-session-store";

export function useCart(organizationSubdomain: string) {
  const {
    getCardByOrganization,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    organizationCards,
  } = useCartSessionStore();

  const products = getCardByOrganization(organizationSubdomain) ?? [];

  const toggleProduct = (productId: string, quantity: string) => {
    if (products.some((product) => product.productId === productId)) {
      removeFromCart(productId, organizationSubdomain);
    } else {
      addToCart(productId, organizationSubdomain, quantity);
    }
  };
  const isProductInCart = (productId: string) => {
    return products.some((product) => product.productId === productId);
  };

  const clearOrganizationCart = () => {
    clearCart(organizationSubdomain);
  };

  return {
    products,
    toggleProduct,
    isProductInCart,
    clearOrganizationCart,
    updateQuantity,
    organizationCards,
  };
}
