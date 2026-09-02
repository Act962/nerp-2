/**
 * HTTP cru da WhatsApp Business Cloud API (Meta), Graph v23.0.
 *
 * Portado do Órbita (`nasaex-wey/src/http/whats-oficial/`). Este módulo expõe
 * **apenas** funções `fetch` puras — sem Prisma, sem realtime, sem regra de
 * domínio. A regra de negócio (qual conexão usar, o que fazer com a mensagem
 * que chegou) vive na PORT, em
 * `src/features/whatsapp-chat/lib/providers/types.ts`.
 *
 *     UI / oRPC → WhatsAppChatProvider (PORT) → MetaCloudProvider → daqui
 *
 * Mesma separação que `src/lib/fiscal/focus-nfe.ts` faz com o provedor fiscal.
 *
 * Base URL sobrescrevível por `WHATSAPP_CLOUD_GRAPH_BASE_URL` — é assim que os
 * testes apontam para um servidor local em vez da Graph de verdade.
 */

export {
  graphFetch,
  graphFetchMultipart,
  graphFetchBinary,
} from "./client";

export { sendOfficialText } from "./send-text";
export { sendOfficialMedia } from "./send-media";
export { sendOfficialLocation } from "./send-location";
export { sendOfficialContact } from "./send-contact";

export { sendOfficialTemplate } from "./send-template";
export { sendMarketingMessage } from "./send-marketing-message";
export { getMessageTemplates } from "./get-message-templates";
export { createMessageTemplate } from "./create-message-template";
export { uploadResumableMedia } from "./upload-resumable-media";

export { uploadOfficialMedia } from "./upload-media";
export {
  getOfficialMediaUrl,
  downloadOfficialMedia,
  downloadInboundMedia,
} from "./get-media";

export {
  whatsAppOfficialWebhookSchema,
  parseWhatsAppOfficialWebhook,
  unwrapCapturedFixture,
} from "./webhook-schema";
export type {
  WhatsAppOfficialWebhook,
  WhatsAppOfficialInboundMessage,
  WhatsAppOfficialStatus,
  WhatsAppOfficialMetadata,
  WhatsAppOfficialContact,
} from "./webhook-schema";

export {
  isMetaSignatureValid,
  verifyWebhookChallenge,
} from "./verify-signature";

// Embedded Signup (Fase 7) — HTTP clients de onboarding/provisioning.
export { exchangeCodeForToken } from "./exchange-code-for-token";
export { subscribeApp } from "./subscribe-app";
export { registerPhone } from "./register-phone";
export { getPhoneNumbers } from "./get-phone-numbers";
export { getWaba } from "./get-waba";

// Analytics (Fase 10) — mensagens, conversas e custo.
export { getMessageAnalytics } from "./get-message-analytics";
export { getConversationAnalytics } from "./get-conversation-analytics";

export type {
  MetaApiError,
  SendMessageResponse,
  MediaUploadResponse,
  MediaUrlResponse,
  E164DigitsOnly,
  MediaId,
  Wamid,
  OutboundMediaKind,
  SendTextInput,
  SendMediaInput,
  SendLocationInput,
  SendContactInput,
  SendTemplateInput,
  SendMarketingMessageInput,
  MarketingMessageProductPolicy,
  UploadMediaInput,
  // Templates HSM (Fase 9)
  MessageTemplate,
  MessageTemplateStatus,
  MessageTemplateCategory,
  TemplateComponent,
  MessageTemplatesResponse,
  // Criação de templates (Campanhas — Fase 2)
  TemplateHeaderFormat,
  CreateTemplateButton,
  CreateTemplateComponent,
  CreateMessageTemplateRequest,
  CreateMessageTemplateResponse,
  ResumableUploadSessionResponse,
  ResumableUploadFileResponse,
  // Embedded Signup (Fase 7)
  OAuthExchangeResponse,
  SubscribeAppResponse,
  RegisterPhoneResponse,
  PhoneNumberMetadata,
  PhoneNumbersListResponse,
  CodeVerificationStatus,
  QualityRating,
  WabaInfo,
  // Analytics (Fase 10)
  MessageAnalyticsGranularity,
  MessageAnalyticsDataPoint,
  MessageAnalyticsResponse,
  ConversationAnalyticsGranularity,
  ConversationCategory,
  ConversationType,
  ConversationDirection,
  ConversationAnalyticsDataPoint,
  ConversationAnalyticsResponse,
} from "./types";
