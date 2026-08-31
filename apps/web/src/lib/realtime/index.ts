/**
 * Composition root do realtime — o único lugar que conhece a lib concreta.
 *
 * `channel-authorizers.ts` e `pusher-publisher.ts` puxam código server-only
 * (Prisma e o SDK de servidor do Pusher) e por isso **não** são reexportados
 * daqui: importe pelo caminho direto no servidor. Este arquivo é seguro no
 * browser.
 */
import { PusherRealtimeSubscriber } from "./pusher-subscriber";
import type { RealtimeSubscriber } from "./types";

export const realtimeSubscriber: RealtimeSubscriber =
  new PusherRealtimeSubscriber();

export type {
  RealtimePublisher,
  RealtimeSubscriber,
  RealtimeChannelSubscription,
  ChannelAuthorizer,
} from "./types";

export {
  conversationChannel,
  funnelChannel,
  orgChannel,
  idDoCanal,
} from "./channels";
