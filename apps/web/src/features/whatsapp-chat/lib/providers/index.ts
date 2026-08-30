/**
 * Ponto de entrada da camada de provedores.
 *
 * Importar este barrel garante que os adapters já estejam registrados na
 * fábrica — cada um se registra no próprio import, e é este arquivo que os
 * puxa. Quem importar direto de `./factory` sem passar por aqui encontra o
 * registro vazio.
 */

// Efeito colateral: registra os adapters na fábrica.
import "./adapters/meta-cloud/provider";
// O de demonstração só se registra quando WHATSAPP_MODO_DEMO=true e o
// ambiente não é produção — ver o próprio arquivo.
import "./adapters/demo/provider";

export {
  clearProviderRegistry,
  createProvider,
  listRegisteredProviders,
  registerProvider,
  UnknownProviderError,
} from "./factory";

export { MetaCloudProvider } from "./adapters/meta-cloud/provider";
export { modoDemoLigado } from "./adapters/demo/provider";
export type { MetaCloudProviderConfig } from "./adapters/meta-cloud/provider";
export { normalizePhoneToMetaE164 } from "./adapters/meta-cloud/normalize-phone";

export {
  clearOutboundProviderCache,
  invalidateOutboundProvider,
  resolveOutboundProvider,
} from "./resolve-outbound-provider";
export type { ResolvedOutboundProvider } from "./resolve-outbound-provider";

export {
  decryptStoredMetaCredentials,
  encryptMetaCredentialsInput,
  maskMetaCredentials,
  MetaCredentialsMissingError,
} from "./meta-credentials";
export type {
  MetaCredentialsInput,
  MetaCredentialsMasked,
  MetaCredentialsPlain,
  MetaCredentialsStored,
} from "./meta-credentials";

export {
  ConnectionNotFoundError,
  MetaCredentialsIncompleteError,
  MetaFeatureUnsupportedError,
  OutboundProviderError,
  OutboundWindowClosedError,
  ProviderFeatureUnsupportedError,
  ProviderSendInvalidResponseError,
} from "./outbound-errors";

export type {
  CanonicalInboundMessage,
  CanonicalInboundStatusUpdate,
  CanonicalMediaKind,
  NormalizedInbound,
  ProviderId,
  ProviderWebhookHeaders,
  SendCanonicalContact,
  SendCanonicalInput,
  SendCanonicalLocation,
  SendCanonicalMedia,
  SendCanonicalTemplate,
  SendCanonicalText,
  SendResult,
  WhatsAppChatProvider,
} from "./types";
