import "server-only";

import PusherServer from "pusher";

// Cliente Pusher do servidor. Instanciado sob demanda, não no import: o módulo
// é puxado por rotas que rodam mesmo com o realtime desconfigurado (ex.: build,
// seed, teste), e um `new PusherServer` com credencial faltando derrubaria tudo
// no import em vez de no ponto de uso.
let cached: PusherServer | null = null;

export function getPusherServer(): PusherServer {
  if (cached) return cached;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error(
      "Realtime não configurado: defina PUSHER_APP_ID, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_APP_KEY e NEXT_PUBLIC_PUSHER_CLUSTER em apps/web/.env",
    );
  }

  cached = new PusherServer({ appId, key, secret, cluster, useTLS: true });
  return cached;
}

/**
 * Sem credencial o realtime fica desligado em vez de quebrar a tela: o chat
 * cai para o refetch do React Query e o resto do ERP nem percebe.
 */
export function isRealtimeConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.NEXT_PUBLIC_PUSHER_APP_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  );
}
