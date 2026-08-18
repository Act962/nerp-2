"use client";

import { useCallback, useEffect, useState } from "react";

export type WaiterIdentity = {
  collaboratorId: string;
  name: string;
  photoUrl: string | null;
  role: string;
};

const storageKey = (orgSlug: string) => `waiter:${orgSlug}`;

// Sessão do garçom no kiosk: persistida em localStorage, escopada por orgSlug.
// Nenhum dado sensível — apenas o id/nome/foto do colaborador escolhido.
export function useWaiterSession(orgSlug: string) {
  const [identity, setIdentity] = useState<WaiterIdentity | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(orgSlug));
      if (raw) setIdentity(JSON.parse(raw) as WaiterIdentity);
    } catch {
      // ignora leitura inválida
    }
    setHydrated(true);
  }, [orgSlug]);

  const save = useCallback(
    (next: WaiterIdentity) => {
      window.localStorage.setItem(storageKey(orgSlug), JSON.stringify(next));
      setIdentity(next);
    },
    [orgSlug],
  );

  const clear = useCallback(() => {
    window.localStorage.removeItem(storageKey(orgSlug));
    setIdentity(null);
  }, [orgSlug]);

  return { identity, hydrated, save, clear };
}
