/**
 * Fábrica de provedores, por registro.
 *
 * **Por que registro e não `enum`/`switch`**: acrescentar um segundo provedor
 * (um não-oficial por QR Code, Twilio, 360dialog) não pode exigir mexer no
 * núcleo do chat. O adapter novo chama `registerProvider("…", builder)` e
 * pronto — nenhum arquivo daqui muda.
 *
 * Cada adapter se registra ao ser importado; o barrel `./index.ts` importa
 * todos, então quem importa `@/features/whatsapp-chat/lib/providers` já os
 * recebe prontos.
 */

import type {
  ProviderBuilder,
  ProviderConfig,
  ProviderId,
  WhatsAppChatProvider,
} from "./types";

const registro = new Map<ProviderId, ProviderBuilder>();

/**
 * Registra um builder. Registrar o mesmo id de novo sobrescreve — conveniente
 * em teste; em produção cada adapter chama uma vez, no import.
 */
export function registerProvider(
  providerId: ProviderId,
  builder: ProviderBuilder,
): void {
  registro.set(providerId, builder);
}

/** Provedores disponíveis — alimenta o seletor da tela de conexão. */
export function listRegisteredProviders(): ReadonlyArray<ProviderId> {
  return Array.from(registro.keys());
}

/** Zera o registro. Existe para os testes começarem do limpo. */
export function clearProviderRegistry(): void {
  registro.clear();
}

export class UnknownProviderError extends Error {
  constructor(providerId: string) {
    super(
      `Provedor de WhatsApp "${providerId}" não está registrado. ` +
        `Registrados: [${Array.from(registro.keys()).join(", ") || "nenhum"}]`,
    );
    this.name = "UnknownProviderError";
  }
}

/**
 * Instancia o provedor. A validação do formato da config é responsabilidade
 * do adapter — aqui só despacha.
 */
export function createProvider(
  providerId: ProviderId,
  config: ProviderConfig,
): WhatsAppChatProvider {
  const builder = registro.get(providerId);
  if (!builder) throw new UnknownProviderError(String(providerId));
  return builder(config);
}
