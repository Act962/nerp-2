"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createPlanogramStore,
  type PlanogramActions,
  type PlanogramState,
  type PlanogramStore,
} from "./planogram-store";
import type { PlanogramScene } from "./types";

const PlanogramStoreContext = createContext<PlanogramStore | null>(null);

export function PlanogramStoreProvider({
  scene,
  children,
}: {
  scene: PlanogramScene;
  children: ReactNode;
}) {
  // useRef e não useState: o store precisa existir já no primeiro render e
  // nunca ser recriado — recriar zeraria histórico e fila de persistência.
  const storeRef = useRef<PlanogramStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createPlanogramStore(scene);
  }

  return (
    <PlanogramStoreContext.Provider value={storeRef.current}>
      {children}
    </PlanogramStoreContext.Provider>
  );
}

export function usePlanogramStore<T>(
  selector: (state: PlanogramState & PlanogramActions) => T,
): T {
  const store = useContext(PlanogramStoreContext);
  if (!store) {
    throw new Error(
      "usePlanogramStore precisa estar dentro de <PlanogramStoreProvider>",
    );
  }
  return useStore(store, selector);
}

/** Acesso imperativo (atalhos de teclado, autosave) sem assinar re-render. */
export function usePlanogramStoreApi(): PlanogramStore {
  const store = useContext(PlanogramStoreContext);
  if (!store) {
    throw new Error(
      "usePlanogramStoreApi precisa estar dentro de <PlanogramStoreProvider>",
    );
  }
  return store;
}
