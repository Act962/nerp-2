"use client";

import { useEffect, useRef } from "react";
import { realtimeSubscriber } from "./index";

type RealtimeHandlers = Record<string, (data: unknown) => void>;

/**
 * Assina um canal e faz `bind` de cada handler, limpando tudo no unmount.
 * Não conhece domínio nem lib.
 *
 * Os handlers vão para uma ref e a subscription só é recriada quando `channel`
 * ou `enabled` mudam — senão um handler recriado a cada render derrubaria e
 * refaria a subscription sem parar, e mensagem chegando nesse intervalo se
 * perde.
 */
export function useRealtimeChannel(
  channel: string | null | undefined,
  handlers: RealtimeHandlers,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !channel) return;

    const subscription = realtimeSubscriber.subscribe(channel);
    for (const event of Object.keys(handlersRef.current)) {
      subscription.bind(event, (data) => handlersRef.current[event]?.(data));
    }

    return () => subscription.unsubscribe();
  }, [channel, enabled]);
}
