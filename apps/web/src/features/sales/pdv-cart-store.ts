import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Carrinho do PDV espelhado fora da memória do React.
 *
 * O carrinho de verdade vive no react-hook-form. Este store é uma CÓPIA para
 * o caso de a tela morrer no meio da venda — crash, deploy trocando os chunks,
 * aba recarregada sem querer. Sem ele, o operador recomeça a passar os itens.
 *
 * `sessionStorage`, não `localStorage`: o carrinho é da sessão daquela aba e
 * não deve reaparecer amanhã noutro turno.
 */
export interface PdvCartItem {
  id: string;
  productId: string;
  name: string;
  currentStock: number;
  sku: string | null;
  unit: string;
  price: number;
  quantity: number;
  cancelled?: boolean;
}

// Meia hora. Passado disso o carrinho foi abandonado, não interrompido —
// ressuscitá-lo criaria venda errada com preço velho.
export const CART_TTL_MS = 30 * 60 * 1000;

interface PdvCartState {
  items: PdvCartItem[];
  savedAt: number | null;
  save: (items: PdvCartItem[], now?: number) => void;
  clear: () => void;
}

export const usePdvCartStore = create<PdvCartState>()(
  persist(
    (set) => ({
      items: [],
      savedAt: null,
      save: (items, now = Date.now()) =>
        set({ items, savedAt: items.length > 0 ? now : null }),
      clear: () => set({ items: [], savedAt: null }),
    }),
    {
      name: "nerp:pdv-cart",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

/**
 * Itens recuperáveis: só dentro da janela. Separada do store para ser testável
 * sem navegador — é aqui que mora a regra que evita venda com preço velho.
 */
export function recoverableItems(
  state: Pick<PdvCartState, "items" | "savedAt">,
  now: number = Date.now(),
): PdvCartItem[] {
  if (state.items.length === 0 || state.savedAt === null) return [];
  if (now - state.savedAt > CART_TTL_MS) return [];
  return state.items;
}
