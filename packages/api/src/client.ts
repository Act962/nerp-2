import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

/**
 * Factory do cliente oRPC do NERP para consumidores FORA do processo do web
 * (desktop, scripts, futuros clients). É genérico sobre o TIPO DO CLIENTE, então
 * este package NÃO depende de `apps/web`.
 *
 * `TClient` pode ser:
 * - `RouterClient<AppRouter>` — no mesmo processo/monorepo com acesso ao tipo do
 *   router (ex.: um script em `apps/web`), inferência total.
 * - um contrato hand-authored das chamadas usadas — para consumidores que NÃO
 *   podem importar `AppRouter` do fonte sem compilar o servidor (o desktop, até
 *   o router ser extraído para um package que emita `.d.ts` na Fase 5).
 *
 * Difere do `src/lib/orpc.ts` do web em dois pontos que só um cliente externo
 * precisa: a base URL é PARÂMETRO (o web usa `window.location.origin`) e o token
 * entra por callback (lido do keychain, no caso do desktop).
 */
export type NerpClientOptions = {
  /** Origem do backend, ex.: "https://erp.suaempresa.com". */
  baseUrl: string;
  /** Bearer de device; retornar null quando ainda não pareado. */
  getToken?: () => string | null | Promise<string | null>;
  /** `fetch` alternativo (ex.: o do Tauri) — default: fetch global. */
  fetch?: typeof globalThis.fetch;
};

export function createNerpClient<TClient>(options: NerpClientOptions): TClient {
  const link = new RPCLink({
    url: `${options.baseUrl.replace(/\/$/, "")}/api/rpc`,
    fetch: options.fetch,
    headers: async () => {
      const token = await options.getToken?.();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });

  return createORPCClient(link) as unknown as TClient;
}
