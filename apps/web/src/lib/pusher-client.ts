import PusherClient from "pusher-js";

// Cliente Pusher do browser. Fica em arquivo separado do `pusher.ts` (que é
// `server-only`) porque o bundle do client não pode puxar o SDK de servidor
// junto — ele carrega `crypto` do Node.

let cached: PusherClient | null = null;

/**
 * `null` quando o realtime não está configurado. Quem consome trata isso como
 * "sem push" e segue com refetch, em vez de quebrar a tela.
 */
export function getPusherClient(): PusherClient | null {
  if (cached) return cached;

  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;

  cached = new PusherClient(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
  });
  return cached;
}
