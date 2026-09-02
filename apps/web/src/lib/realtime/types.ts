/**
 * Portas da camada de realtime.
 *
 * O domínio depende destes contratos, nunca da lib concreta. A implementação é
 * plugada em `index.ts` — trocar Pusher por SSE (o padrão que já existe em
 * `api/scanner/stream`) é trocar os adapters de lá, sem tocar em nenhum
 * componente do chat.
 */

/** Servidor: publica um evento num canal. */
export interface RealtimePublisher {
  publish(channel: string, event: string, payload: unknown): Promise<void>;
}

/** Assinatura ativa de um canal no browser. */
export interface RealtimeChannelSubscription {
  bind(event: string, handler: (data: unknown) => void): void;
  unbindAll(): void;
  unsubscribe(): void;
}

/** Browser: assina um canal. */
export interface RealtimeSubscriber {
  subscribe(channel: string): RealtimeChannelSubscription;
}

/**
 * Decide se um usuário pode assinar um canal privado. Cada domínio com canal
 * privado registra o seu em `channel-authorizers.ts`, para o endpoint de auth
 * não virar um `switch` que cresce sem fim.
 */
export interface ChannelAuthorizer {
  /** Este authorizer é o responsável por validar este canal? */
  matches(channel: string): boolean;
  /** `userId` pode assinar `channel`? */
  authorize(channel: string, userId: string): Promise<boolean>;
}
