import useLocalStorage from "use-local-storage";
const CART_KEY = "@cart_products";

interface UseShoppingCartProps {
  id: string;
  quantity: number;
}

export function useShoppingCart() {
  const [cartItems, setCartItems] = useLocalStorage<UseShoppingCartProps[]>(
    CART_KEY,
    []
  );

  function addToCart(product: UseShoppingCartProps, quantity: number = 1) {
    const existingItem = cartItems.find((item) => item.id === product.id);

    if (existingItem) {
      setCartItems(
        cartItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      setCartItems([
        ...cartItems,
        {
          ...product,
          quantity,
        },
      ]);
    }
  }
  function removeFromCart(id: string) {
    setCartItems(cartItems.filter((item) => item.id !== id));
  }
  function updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }

    setCartItems(
      cartItems.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }
  function clearCart() {
    setCartItems([]);
  }

  const itemsCount = cartItems.length;
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    itemsCount,
    totalQuantity,
  };
}
