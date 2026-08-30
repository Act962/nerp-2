import "server-only";

import { getPusherServer, isRealtimeConfigured } from "@/lib/pusher";
import type { RealtimePublisher } from "./types";

/**
 * Adapter Pusher da porta `RealtimePublisher`.
 *
 * Engole erro de transporte de propósito: broadcast é efeito colateral
 * best-effort e nunca pode derrubar o fluxo que o disparou. Uma mensagem já
 * gravada no banco não pode falhar porque o Pusher caiu — o cliente veria erro
 * de envio numa mensagem que saiu.
 */
export class PusherRealtimePublisher implements RealtimePublisher {
  async publish(
    channel: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    if (!isRealtimeConfigured()) return;

    try {
      await getPusherServer().trigger(channel, event, payload);
    } catch (error) {
      console.error(
        `[realtime] publish falhou (channel=${channel} event=${event})`,
        error,
      );
    }
  }
}
