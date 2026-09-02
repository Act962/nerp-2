import type { Channel } from "pusher-js";
import { getPusherClient } from "@/lib/pusher-client";
import type { RealtimeChannelSubscription, RealtimeSubscriber } from "./types";

/**
 * Adapter Pusher (browser) da porta `RealtimeSubscriber`.
 *
 * O `pusherClient` é singleton do app inteiro, então cada subscription guarda
 * os próprios handlers para dar `unbind` só nos seus no cleanup — senão uma
 * tela que desmonta derruba os handlers de outra que assina o mesmo canal.
 */
class PusherChannelSubscription implements RealtimeChannelSubscription {
  private readonly handlers = new Map<string, (data: unknown) => void>();

  constructor(
    private readonly channelName: string,
    private readonly channel: Channel,
  ) {}

  bind(event: string, handler: (data: unknown) => void): void {
    this.handlers.set(event, handler);
    this.channel.bind(event, handler);
  }

  unbindAll(): void {
    for (const [event, handler] of this.handlers) {
      this.channel.unbind(event, handler);
    }
    this.handlers.clear();
  }

  unsubscribe(): void {
    this.unbindAll();
    getPusherClient()?.unsubscribe(this.channelName);
  }
}

/** Usada quando o realtime não está configurado: tudo vira no-op. */
class NoopSubscription implements RealtimeChannelSubscription {
  bind(): void {}
  unbindAll(): void {}
  unsubscribe(): void {}
}

export class PusherRealtimeSubscriber implements RealtimeSubscriber {
  subscribe(channel: string): RealtimeChannelSubscription {
    const client = getPusherClient();
    if (!client) return new NoopSubscription();
    return new PusherChannelSubscription(channel, client.subscribe(channel));
  }
}
