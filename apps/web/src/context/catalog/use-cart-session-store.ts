import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface CartSession {
  productId: string;
  quantity: string;
}

interface CartState {
  organizationCards: Record<string, CartSession[]>;
  addToCart: (
    productId: string,
    organizationSubdomain: string,
    quantity: string
  ) => void;
  removeFromCart: (productId: string, organizationSubdomain: string) => void;
  updateQuantity: (
    productId: string,
    organizationSubdomain: string,
    quantity: string
  ) => void;
  clearCart: (organizationSubdomain: string) => void;
  getCardByOrganization: (organizationSubdomain: string) => CartSession[];
}

export const useCartSessionStore = create<CartState>()(
  persist(
    (set, get) => ({
      organizationCards: {},

      addToCart: (productId, organizationSubdomain, quantity) => {
        set((state) => ({
          organizationCards: {
            ...state.organizationCards,
            [organizationSubdomain]: [
              ...(state.organizationCards[organizationSubdomain] ?? []),
              {
                productId: productId,
                quantity,
              },
            ],
          },
        }));
      },
      removeFromCart: (productId, organizationSubdomain) => {
        set((state) => ({
          organizationCards: {
            ...state.organizationCards,
            [organizationSubdomain]: (
              state.organizationCards[organizationSubdomain] ?? []
            ).filter((item) => item.productId !== productId),
          },
        }));
      },

      updateQuantity: (productId, organizationSubdomain, quantity) => {
        set((state) => ({
          organizationCards: {
            ...state.organizationCards,
            [organizationSubdomain]: (
              state.organizationCards[organizationSubdomain] ?? []
            ).map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          },
        }));
      },
      clearCart: (organizationSubdomain) => {
        set(() => ({
          organizationCards: {
            ...get().organizationCards,
            [organizationSubdomain]: [],
          },
        }));
      },
      getCardByOrganization: (organizationSubdomain) => {
        return get().organizationCards[organizationSubdomain] ?? [];
      },
    }),
    {
      name: "funroad_card",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
