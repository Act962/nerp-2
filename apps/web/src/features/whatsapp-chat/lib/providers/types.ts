/**
 * PORT do atendimento por WhatsApp — `WhatsAppChatProvider`.
 *
 * É o contrato que o oRPC e a UI enxergam. O adapter concreto (hoje só a
 * Cloud API oficial da Meta) fica atrás dele:
 *
 *     oRPC / UI ──► WhatsAppChatProvider ──► MetaCloudProvider ──► src/lib/whatsapp-cloud
 *
 * Portado do Órbita (`nasaex-wey/src/features/tracking-chat/lib/providers/`),
 * com duas podas: os campos que só o provedor **não-oficial** de lá preenchia
 * (token e nome de instância, dono do número) e a flag `markPreviousAsRead`,
 * que a Meta ignora. Flag que nenhum adapter honra é mentira na interface —
 * quem for adicionar um provedor por QR Code depois traz os dois de volta.
 *
 * O vocabulário canônico abaixo, esse sim, fica inteiro: é justamente o que
 * mantém a pipeline de entrada agnóstica ao provedor.
 */

// ─────────────────────────────────────────────────────────────────────────
// Entrada canônica — o que a pipeline recebe, já sem sotaque de provedor
// ─────────────────────────────────────────────────────────────────────────

/**
 * Onde a mensagem chegou. Para a Meta, `externalId` é o `phone_number_id` —
 * é por ele que o webhook descobre a qual conexão (e organização) o payload
 * pertence.
 */
export interface CanonicalInboundInstance {
  /** Id externo do número que recebeu. */
  readonly externalId: string;
  /** Telefone do número que recebeu, E.164 sem `+`, quando o provedor manda. */
  readonly displayPhone?: string;
}

/** Quem enviou. A pipeline resolve isso para um `CrmLead` pelo telefone. */
export interface CanonicalInboundSender {
  /** E.164 sem `+` (ex.: `5586988923098`). */
  readonly phone: string;
  readonly displayName?: string;
  /** `true` quando a mensagem saiu do próprio número (eco do atendente). */
  readonly fromMe: boolean;
}

interface InboundBase {
  /** Id da mensagem no provedor (`wamid…`). Chave de idempotência. */
  readonly externalMessageId: string;
  /** Timestamp do provedor, já normalizado. */
  readonly sentAt: Date;
  /** Id externo da mensagem respondida, quando é um reply. */
  readonly replyToExternalMessageId?: string;
  readonly sender: CanonicalInboundSender;
  readonly instance: CanonicalInboundInstance;
}

export interface CanonicalInboundText extends InboundBase {
  readonly type: "text";
  readonly body: string;
}

/**
 * Mídia recebida. A Meta manda `mediaId` e a URL de download expira em
 * poucos minutos — por isso o id é o caminho preferido, e `mediaUrl` fica
 * como alternativa para provedores que só dão a URL.
 */
export interface CanonicalInboundMedia extends InboundBase {
  readonly type: "media";
  readonly kind: CanonicalMediaKind;
  readonly mediaId?: string;
  readonly mediaUrl?: string;
  readonly mimetype?: string;
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly caption?: string;
  readonly sha256?: string;
  /** Nota de voz (a Meta marca `audio.voice=true`). */
  readonly isVoice?: boolean;
}

export interface CanonicalInboundLocation extends InboundBase {
  readonly type: "location";
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
  readonly address?: string;
}

export interface CanonicalInboundContact extends InboundBase {
  readonly type: "contact";
  readonly contactName: string;
  readonly contactPhone: string;
}

/** Reação (emoji) a uma mensagem anterior. */
export interface CanonicalInboundReaction extends InboundBase {
  readonly type: "reaction";
  readonly targetExternalMessageId: string;
  readonly emoji?: string;
}

/** Resposta a botão ou lista interativa. */
export interface CanonicalInboundInteractiveReply extends InboundBase {
  readonly type: "interactive_reply";
  readonly replyId?: string;
  readonly replyText?: string;
}

/**
 * Tipo que a aplicação ainda não trata. Guardado como referência em vez de
 * descartado em silêncio: quando a Meta lança um tipo novo, é este ramo que
 * aparece no log e diz qual é.
 */
export interface CanonicalInboundUnsupported extends InboundBase {
  readonly type: "unsupported";
  readonly providerType?: string;
}

export type CanonicalInboundMessage =
  | CanonicalInboundText
  | CanonicalInboundMedia
  | CanonicalInboundLocation
  | CanonicalInboundContact
  | CanonicalInboundReaction
  | CanonicalInboundInteractiveReply
  | CanonicalInboundUnsupported;

export interface CanonicalInboundStatusUpdate {
  readonly externalMessageId: string;
  readonly status: "sent" | "delivered" | "read" | "failed";
  readonly at: Date;
  readonly recipientPhone?: string;
  readonly errorReason?: string;
}

/**
 * Um payload de webhook pode trazer várias mensagens e vários avisos de
 * status ao mesmo tempo — a Meta agrupa em `entry[].changes[].value`.
 */
export interface NormalizedInbound {
  readonly messages: ReadonlyArray<CanonicalInboundMessage>;
  readonly statusUpdates?: ReadonlyArray<CanonicalInboundStatusUpdate>;
}

// ─────────────────────────────────────────────────────────────────────────
// Envio canônico
// ─────────────────────────────────────────────────────────────────────────

interface SendBase {
  /** Destino, E.164 sem `+`. */
  readonly to: string;
  readonly replyToExternalMessageId?: string;
}

export interface SendCanonicalText extends SendBase {
  readonly kind: "text";
  readonly body: string;
  readonly previewUrl?: boolean;
}

export type CanonicalMediaKind =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker";

export interface SendCanonicalMedia extends SendBase {
  readonly kind: "media";
  readonly mediaKind: CanonicalMediaKind;
  /**
   * URL pública **ou** um `mediaId` já enviado ao provedor. O adapter prefere
   * o id quando existe: a Meta baixa a URL de fora, e um bucket privado não
   * serve para isso.
   */
  readonly mediaUrl?: string;
  readonly mediaId?: string;
  readonly mimetype?: string;
  readonly fileName?: string;
  readonly caption?: string;
  /** Nota de voz. A Meta exige OGG/Opus; sem a flag chega como áudio comum. */
  readonly isVoice?: boolean;
}

export interface SendCanonicalLocation extends SendBase {
  readonly kind: "location";
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
  readonly address?: string;
}

export interface SendCanonicalContact extends SendBase {
  readonly kind: "contact";
  readonly fullName: string;
  readonly phoneNumber: string;
  readonly organization?: string;
  readonly email?: string;
}

/**
 * Template aprovado (HSM) — o único jeito de falar com alguém fora da janela
 * de 24 horas, e o que as campanhas usam.
 */
export interface SendCanonicalTemplate extends SendBase {
  readonly kind: "template";
  readonly templateName: string;
  /** Idioma exato do template aprovado (ex.: `pt_BR`). */
  readonly languageCode: string;
  readonly bodyParameters?: string[];
  readonly headerParameters?: string[];
}

export type SendCanonicalInput =
  | SendCanonicalText
  | SendCanonicalMedia
  | SendCanonicalLocation
  | SendCanonicalContact
  | SendCanonicalTemplate;

export interface SendResult {
  /** Vai para `Message.externalMessageId`. */
  readonly externalMessageId: string;
  /** Resposta crua do provedor — opaca para a UI, útil no log. */
  readonly raw: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// A PORT
// ─────────────────────────────────────────────────────────────────────────

/**
 * String aberta, não enum: registrar um segundo adapter amanhã não pode
 * exigir mexer neste arquivo.
 */
export type ProviderId = "meta-cloud" | (string & {});

/** Headers HTTP do webhook, em minúsculas. */
export type ProviderWebhookHeaders = Readonly<
  Record<string, string | undefined>
>;

export interface UploadCanonicalMedia {
  readonly file: Buffer;
  readonly mimetype: string;
  readonly fileName?: string;
}

export interface WhatsAppChatProvider {
  readonly id: ProviderId;

  sendText(input: SendCanonicalText): Promise<SendResult>;
  sendMedia(input: SendCanonicalMedia): Promise<SendResult>;

  /**
   * Sobe um arquivo ao provedor e devolve o id para usar em `sendMedia`.
   *
   * Está na porta, e não no chamador, porque só o adapter conhece a credencial
   * — e porque a alternativa (mandar `mediaUrl`) exige bucket público. O nosso
   * é privado de propósito: mídia de conversa de cliente não fica endereçável
   * por quem adivinhar a chave.
   */
  uploadMedia(input: UploadCanonicalMedia): Promise<{ mediaId: string }>;
  sendLocation(input: SendCanonicalLocation): Promise<SendResult>;
  sendContact(input: SendCanonicalContact): Promise<SendResult>;
  sendTemplate(input: SendCanonicalTemplate): Promise<SendResult>;

  /**
   * Autenticidade do webhook. Para a Meta é HMAC-SHA256 do corpo **cru** com
   * o App Secret, no header `x-hub-signature-256`.
   *
   * `rawBody` tem que ser exatamente o texto recebido, sem reparse: qualquer
   * reserialização muda os bytes e a assinatura deixa de bater. Falha fechada
   * — qualquer erro devolve `false`.
   */
  verifyWebhook(rawBody: string, headers: ProviderWebhookHeaders): boolean;

  /**
   * Converte o payload já parseado no formato canônico. `null` quando o
   * payload não é deste provedor ou está malformado, para o chamador logar e
   * ignorar em vez de estourar.
   */
  normalizeInbound(rawPayload: unknown): NormalizedInbound | null;
}

/**
 * Config genérica aceita pela fábrica. Cada adapter faz o cast para o próprio
 * formato e valida. Manter `unknown` aqui é o que permite registrar um adapter
 * de fora sem alterar este arquivo.
 */
export type ProviderConfig = unknown;

export type ProviderBuilder = (config: ProviderConfig) => WhatsAppChatProvider;
