import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface CartSession {
  productId: string;
  quantity: string;
  /**
   * Observação do cliente para esta linha ("sem cebola").
   *
   * Opcional e aditivo de propósito: o `persist` não tem `version`/`migrate`,
   * então carrinho já salvo no aparelho de alguém continua válido.
   */
  notes?: string;
}

interface CartState {
  organizationCards: Record<string, CartSession[]>;
  addToCart: (
    productId: string,
    organizationSubdomain: string,
    quantity: string,
    notes?: string,
  ) => void;
  removeFromCart: (productId: string, organizationSubdomain: string) => void;
  updateQuantity: (
    productId: string,
    organizationSubdomain: string,
    quantity: string,
  ) => void;
  updateNotes: (
    productId: string,
    organizationSubdomain: string,
    notes: string,
  ) => void;
  clearCart: (organizationSubdomain: string) => void;
  getCardByOrganization: (organizationSubdomain: string) => CartSession[];
}

export const useCartSessionStore = create<CartState>()(
  persist(
    (set, get) => ({
      organizationCards: {},

      addToCart: (productId, organizationSubdomain, quantity, notes) => {
        set((state) => {
          const atual = state.organizationCards[organizationSubdomain] ?? [];
          // UMA linha por produto. Duas linhas do mesmo produto com observações
          // diferentes exigiriam um id de linha e mudariam o contrato
          // `products: [{id, quantity}]` em todo o checkout — fica para quando
          // o cardápio ganhar adicionais.
          const jaExiste = atual.some((item) => item.productId === productId);
          return {
            organizationCards: {
              ...state.organizationCards,
              [organizationSubdomain]: jaExiste
                ? atual.map((item) =>
                    item.productId === productId
                      ? { ...item, quantity, notes: notes ?? item.notes }
                      : item,
                  )
                : [...atual, { productId, quantity, notes }],
            },
          };
        });
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
              item.productId === productId ? { ...item, quantity } : item,
            ),
          },
        }));
      },
      updateNotes: (productId, organizationSubdomain, notes) => {
        set((state) => ({
          organizationCards: {
            ...state.organizationCards,
            [organizationSubdomain]: (
              state.organizationCards[organizationSubdomain] ?? []
            ).map((item) =>
              item.productId === productId ? { ...item, notes } : item,
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
    },
  ),
);
