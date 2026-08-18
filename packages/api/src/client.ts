import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

/**
 * Factory do cliente oRPC do NERP para consumidores FORA do processo do web
 * (desktop, scripts, futuros clients). É genérico sobre o tipo do router, então
 * este package NÃO depende de `apps/web` — quem junta o tipo (`AppRouter`) com
 * a factory é o consumidor.
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

// biome-ignore lint/suspicious/noExplicitAny: TRouter é o tipo do router oRPC do web, resolvido no consumidor.
export function createNerpClient<TRouter extends Record<string, any>>(
  options: NerpClientOptions,
): RouterClient<TRouter> {
  const link = new RPCLink({
    url: `${options.baseUrl.replace(/\/$/, "")}/api/rpc`,
    fetch: options.fetch,
    headers: async () => {
      const token = await options.getToken?.();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });

  return createORPCClient(link);
}
