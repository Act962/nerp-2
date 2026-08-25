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

/**
 * Alcance REAL do backend: bate no `/api/health` (barato, sem DB). É o que
 * distingue "server acessível" de "navigator diz online mas o server caiu" —
 * o `navigator.onLine` sozinho mente. Timeout curto para não travar a UI.
 */
export async function pingBackend(
  baseUrl: string,
  timeoutMs = 3000,
): Promise<boolean> {
  if (!isOnline()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Assina os eventos online/offline do browser. Retorna a função de limpeza. */
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

/**
 * Observa o ALCANCE REAL do backend (não só `navigator.onLine`): faz ping
 * agora, a cada `intervalMs`, e sempre que o browser sinaliza online/offline.
 * Chama `onChange` só quando o estado muda. Retorna a função de limpeza.
 */
export function watchReachability(
  baseUrl: string,
  onChange: (reachable: boolean) => void,
  intervalMs = 15000,
): () => void {
  let last: boolean | null = null;
  let stopped = false;

  const check = async () => {
    const reachable = await pingBackend(baseUrl);
    if (stopped) return;
    if (reachable !== last) {
      last = reachable;
      onChange(reachable);
    }
  };

  void check();
  const timer = setInterval(() => void check(), intervalMs);
  const offline = () => {
    if (last !== false) {
      last = false;
      onChange(false);
    }
  };
  const online = () => void check();
  if (typeof window !== "undefined") {
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
  }

  return () => {
    stopped = true;
    clearInterval(timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    }
  };
}
