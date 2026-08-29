"use client";

import { useEffect, useRef, useState } from "react";

const VERSION_URL = "/api/version";
// De 5 em 5 minutos: barato o bastante para ficar ligado o dia todo no PDV e
// rápido o bastante para avisar antes do operador esbarrar num chunk morto.
const POLL_MS = 5 * 60 * 1000;

async function fetchBuildId(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(VERSION_URL, { signal, cache: "no-store" });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && "buildId" in data) {
      const id = (data as { buildId: unknown }).buildId;
      return typeof id === "string" && id.length > 0 ? id : null;
    }
    return null;
  } catch {
    // Rede caiu ou a aba foi fechada: não é sinal de versão nova.
    return null;
  }
}

/**
 * `true` quando o servidor passou a servir um build diferente do que esta aba
 * carregou — ou seja, saiu deploy enquanto a tela estava aberta.
 *
 * A primeira leitura define a referência; comparações são sempre contra ela.
 * Falha de rede nunca vira "versão nova": só um id lido com sucesso e
 * diferente do inicial conta.
 */
export function useAppVersion(): { newVersion: boolean } {
  const initial = useRef<string | null>(null);
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    // Já detectado: para de perguntar, o aviso não fica mais preciso.
    if (newVersion) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      const id = await fetchBuildId(controller.signal);
      if (id === null) return;
      if (initial.current === null) {
        initial.current = id;
        return;
      }
      if (id !== initial.current) setNewVersion(true);
    };

    void check();
    timer = setInterval(() => void check(), POLL_MS);

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [newVersion]);

  return { newVersion };
}
