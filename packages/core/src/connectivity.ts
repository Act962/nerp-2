/**
 * Detecção de conexão.
 *
 * `navigator.onLine` responde na hora mas mente (diz online com rede sem saída).
 * Um heartbeat leve contra um endpoint distingue "sem rede" de "server fora" —
 * é o que decide entre modo online e offline no PDV.
 */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Ping leve; true se o backend respondeu. Timeout curto para não travar a UI. */
export async function pingBackend(
  baseUrl: string,
  timeoutMs = 3000,
): Promise<boolean> {
  if (!isOnline()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // HEAD na raiz da API; qualquer resposta HTTP significa "server acessível".
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/rpc`, {
      method: "HEAD",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Assina mudanças de conectividade do browser. Retorna a função de limpeza. */
export function onConnectivityChange(
  handler: (online: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => handler(true);
  const off = () => handler(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
  };
}
