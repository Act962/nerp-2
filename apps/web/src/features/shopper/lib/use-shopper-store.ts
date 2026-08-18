"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ShopperSession {
  shopperId: string;
  token: string;
  name: string | null;
  email: string;
}

interface ShopperStore {
  session: ShopperSession | null;
  setSession: (session: ShopperSession) => void;
  clear: () => void;
}

// Sessão leve do cliente no cliente (bearer token). Persistida no localStorage.
export const useShopperStore = create<ShopperStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clear: () => set({ session: null }),
    }),
    { name: "shopper-session" },
  ),
);
