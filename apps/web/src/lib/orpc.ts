import type { router } from "@/app/router";
import type { RouterClient } from "@orpc/server";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCClient } from "@orpc/client";
import { notifySessionExpired } from "@/lib/session-expired";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

declare global {
  var $client: RouterClient<typeof router> | undefined;
}

const link = new RPCLink({
  url: () => {
    if (typeof window === "undefined") {
      throw new Error("RPCLink is not allowed on the server side.");
    }

    return `${window.location.origin}/api/rpc`;
  },
  /**
   * Sessão vencida não pode falhar muda. Sem isto o 401 virava uma promise
   * rejeitada que ninguém tratava: a tela seguia de pé com o cache antigo e o
   * operador só descobria o problema quando o total não fechava.
   */
  fetch: async (request, init) => {
    const response = await globalThis.fetch(request, init);
    if (response.status === 401) notifySessionExpired();
    return response;
  },
});

/**
 * Fallback to client-side client if server-side client is not available.
 */
export const client: RouterClient<typeof router> =
  globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
