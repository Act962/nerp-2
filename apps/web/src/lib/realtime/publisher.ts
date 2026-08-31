import "server-only";

import { PusherRealtimePublisher } from "./pusher-publisher";
import type { RealtimePublisher } from "./types";

/**
 * Composition root do lado servidor. Separado do `index.ts` porque aquele é
 * importado pelo browser — juntar os dois arrastaria o SDK de servidor do
 * Pusher (que usa `crypto` do Node) para dentro do bundle do client.
 */
export const realtimePublisher: RealtimePublisher =
  new PusherRealtimePublisher();
