/**
 * Adapter da PORT sobre a WhatsApp Business Cloud API, em cima do cliente HTTP
 * cru de `src/lib/whatsapp-cloud`.
 *
 * Mapeamento canônico ↔ Meta:
 *  - `to` canônico e o da Meta são o mesmo formato (E.164 sem `+`), mas passa
 *    por `normalizePhoneToMetaE164` porque o `wa_id` brasileiro pode chegar
 *    sem o nono dígito;
 *  - mídia prefere `mediaId` (já enviado à Meta) e cai para `{ link }` quando
 *    só há URL pública;
 *  - as cinco categorias de mídia são as mesmas dos dois lados;
 *  - a entrada usa o schema Zod do cliente e desempacota
 *    `entry[].changes[].value.messages[]`.
 *
 * O adapter se registra na fábrica ao ser importado (final do arquivo).
 */
import "server-only";
import { z } from "zod";

import {
  isMetaSignatureValid,
  type MetaApiError,
  parseWhatsAppOfficialWebhook,
  sendOfficialContact,
  sendOfficialLocation,
  sendOfficialMedia,
  sendOfficialTemplate,
  sendOfficialText,
  type WhatsAppOfficialInboundMessage,
  type WhatsAppOfficialMetadata,
  type WhatsAppOfficialStatus,
} from "@/lib/whatsapp-cloud";

import { registerProvider } from "../../factory";
import {
  OutboundWindowClosedError,
  ProviderSendInvalidResponseError,
} from "../../outbound-errors";
import type {
  CanonicalInboundMessage,
  CanonicalInboundStatusUpdate,
  CanonicalMediaKind,
  NormalizedInbound,
  ProviderBuilder,
  ProviderConfig,
  ProviderWebhookHeaders,
  SendCanonicalContact,
  SendCanonicalLocation,
  SendCanonicalMedia,
  UploadCanonicalMedia,
  SendCanonicalTemplate,
  SendCanonicalText,
  SendResult,
  WhatsAppChatProvider,
} from "../../types";
import { uploadOfficialMedia } from "@/lib/whatsapp-cloud/upload-media";
import { normalizePhoneToMetaE164 } from "./normalize-phone";

/**
 * Códigos que a Graph devolve quando a janela de 24 horas fechou:
 * `131047` (precisa reengajar por template) e `131051` (tipo não aceito fora
 * da janela).
 */
const CODIGOS_JANELA_FECHADA = new Set([131047, 131051]);

/** Converte o erro genérico da Graph no erro tipado de janela fechada. */
function relancarJanelaFechada(error: unknown): never {
  const metaError = (error as { metaError?: MetaApiError["error"] })?.metaError;
  if (metaError?.code && CODIGOS_JANELA_FECHADA.has(metaError.code)) {
    throw new OutboundWindowClosedError(metaError.message);
  }
  throw error;
}

const metaCloudConfigSchema = z.object({
  accessToken: z.string().min(1, "accessToken da Meta é obrigatório"),
  phoneNumberId: z.string().min(1, "phoneNumberId da Meta é obrigatório"),
  /**
   * Usado para validar a assinatura `x-hub-signature-256` do webhook. Sem ele
   * o `verifyWebhook` devolve `false` — falha fechada.
   */
  appSecret: z.string().optional(),
});

export type MetaCloudProviderConfig = z.infer<typeof metaCloudConfigSchema>;

function montarInstancia(metadata: WhatsAppOfficialMetadata) {
  return {
    externalId: metadata.phone_number_id,
    displayPhone: metadata.display_phone_number,
  } as const;
}

function montarRemetente(
  message: WhatsAppOfficialInboundMessage,
  contactName?: string,
) {
  return {
    phone: message.from,
    displayName: contactName,
    // A Meta não ecoa pelo webhook as mensagens que o próprio número enviou.
    fromMe: false,
  } as const;
}

function normalizarMensagem(
  message: WhatsAppOfficialInboundMessage,
  metadata: WhatsAppOfficialMetadata,
  contactName?: string,
): CanonicalInboundMessage {
  const enviadaEm = new Date(Number(message.timestamp) * 1000);
  const base = {
    externalMessageId: message.id,
    sentAt: Number.isNaN(enviadaEm.getTime()) ? new Date() : enviadaEm,
    replyToExternalMessageId: message.context?.id,
    sender: montarRemetente(message, contactName),
    instance: montarInstancia(metadata),
  } as const;

  switch (message.type) {
    case "text":
      return { ...base, type: "text", body: message.text.body };

    case "image":
      return {
        ...base,
        type: "media",
        kind: "image",
        mediaId: message.image.id,
        mediaUrl: message.image.url,
        mimetype: message.image.mime_type,
        sha256: message.image.sha256,
        caption: message.image.caption,
      };

    case "video":
      return {
        ...base,
        type: "media",
        kind: "video",
        mediaId: message.video.id,
        mediaUrl: message.video.url,
        mimetype: message.video.mime_type,
        sha256: message.video.sha256,
        caption: message.video.caption,
      };

    case "audio":
      return {
        ...base,
        type: "media",
        kind: "audio",
        mediaId: message.audio.id,
        mediaUrl: message.audio.url,
        mimetype: message.audio.mime_type,
        sha256: message.audio.sha256,
        isVoice: message.audio.voice,
      };

    case "document":
      return {
        ...base,
        type: "media",
        kind: "document",
        mediaId: message.document.id,
        mediaUrl: message.document.url,
        mimetype: message.document.mime_type,
        sha256: message.document.sha256,
        fileName: message.document.filename,
        caption: message.document.caption,
      };

    case "sticker":
      return {
        ...base,
        type: "media",
        kind: "sticker",
        mediaId: message.sticker.id,
        mediaUrl: message.sticker.url,
        mimetype: message.sticker.mime_type,
        sha256: message.sticker.sha256,
      };

    case "location":
      return {
        ...base,
        type: "location",
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        name: message.location.name,
        address: message.location.address,
      };

    case "contacts": {
      // A Meta manda um array; pegamos o primeiro. Cartão com vários contatos
      // é raro e a conversa mostra um por bolha.
      const primeiro = message.contacts[0] as
        | Record<string, unknown>
        | undefined;
      const nome = (primeiro?.name as Record<string, unknown> | undefined)?.[
        "formatted_name"
      ];
      const telefones = primeiro?.phones as
        | Array<Record<string, unknown>>
        | undefined;
      const telefone = telefones?.[0]?.["phone"];
      return {
        ...base,
        type: "contact",
        contactName: typeof nome === "string" ? nome : "",
        contactPhone: typeof telefone === "string" ? telefone : "",
      };
    }

    case "reaction":
      return {
        ...base,
        type: "reaction",
        targetExternalMessageId: message.reaction.message_id,
        emoji: message.reaction.emoji,
      };

    case "button":
      return {
        ...base,
        type: "interactive_reply",
        replyId: message.button.payload,
        replyText: message.button.text,
      };

    case "interactive": {
      // `interactive` tem variantes (button_reply, list_reply, …). Extrai o
      // que der sem amarrar no formato de cada uma.
      const interativo = message.interactive as Record<string, unknown>;
      const respostaBotao = interativo.button_reply as
        | Record<string, unknown>
        | undefined;
      const respostaLista = interativo.list_reply as
        | Record<string, unknown>
        | undefined;
      const resposta = respostaBotao ?? respostaLista;
      return {
        ...base,
        type: "interactive_reply",
        replyId: resposta?.["id"] as string | undefined,
        replyText: resposta?.["title"] as string | undefined,
      };
    }

    default:
      // Tipo novo da Meta: guarda qual foi, em vez de sumir em silêncio.
      return {
        ...base,
        type: "unsupported",
        providerType: (message as { type: string }).type,
      };
  }
}

function normalizarStatus(
  status: WhatsAppOfficialStatus,
): CanonicalInboundStatusUpdate {
  const em = new Date(Number(status.timestamp) * 1000);
  return {
    externalMessageId: status.id,
    status: status.status,
    at: Number.isNaN(em.getTime()) ? new Date() : em,
    recipientPhone: status.recipient_id,
    errorReason: status.errors?.[0]
      ? JSON.stringify(status.errors[0])
      : undefined,
  };
}

/**
 * Tira o `wamid` da resposta.
 *
 * Se a Meta devolveu 200 sem id — acontece em soft-fail e limite de taxa —
 * falha em vez de seguir. Gravar `externalMessageId` vazio colidiria na
 * coluna única na próxima ocorrência, e apagar por id vazio atingiria a
 * mensagem errada.
 */
function extrairWamid(
  response: { messages: Array<{ id: string }> },
  operacao: string,
): string {
  const wamid = response.messages[0]?.id;
  if (!wamid) {
    throw new ProviderSendInvalidResponseError(
      "meta-cloud",
      operacao,
      `Resposta: ${JSON.stringify(response).slice(0, 200)}`,
    );
  }
  return wamid;
}

export class MetaCloudProvider implements WhatsAppChatProvider {
  readonly id = "meta-cloud" as const;

  constructor(private readonly config: MetaCloudProviderConfig) {}

  async sendText(input: SendCanonicalText): Promise<SendResult> {
    const response = await sendOfficialText(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        body: input.body,
        previewUrl: input.previewUrl,
        replyToWamid: input.replyToExternalMessageId,
      },
    ).catch(relancarJanelaFechada);
    return {
      externalMessageId: extrairWamid(response, "sendText"),
      raw: response,
    };
  }

  async uploadMedia(input: UploadCanonicalMedia): Promise<{ mediaId: string }> {
    const resposta = await uploadOfficialMedia(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        file: input.file,
        mimetype: input.mimetype,
        filename: input.fileName,
      },
    );
    if (!resposta?.id) {
      throw new Error("A Meta aceitou o upload mas não devolveu o id.");
    }
    return { mediaId: resposta.id };
  }

  async sendMedia(input: SendCanonicalMedia): Promise<SendResult> {
    const idOuLink = input.mediaId ?? input.mediaUrl;
    if (!idOuLink) {
      throw new Error("sendMedia: é preciso `mediaId` ou `mediaUrl`.");
    }
    const response = await sendOfficialMedia(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        kind: input.mediaKind satisfies CanonicalMediaKind,
        mediaIdOrLink: idOuLink,
        caption: input.caption,
        filename: input.fileName,
        voice: input.isVoice,
        replyToWamid: input.replyToExternalMessageId,
      },
    ).catch(relancarJanelaFechada);
    return {
      externalMessageId: extrairWamid(response, "sendMedia"),
      raw: response,
    };
  }

  async sendTemplate(input: SendCanonicalTemplate): Promise<SendResult> {
    const response = await sendOfficialTemplate(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyParameters: input.bodyParameters,
        headerParameters: input.headerParameters,
        replyToWamid: input.replyToExternalMessageId,
      },
    );
    return {
      externalMessageId: extrairWamid(response, "sendTemplate"),
      raw: response,
    };
  }

  async sendLocation(input: SendCanonicalLocation): Promise<SendResult> {
    const response = await sendOfficialLocation(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        address: input.address,
        replyToWamid: input.replyToExternalMessageId,
      },
    ).catch(relancarJanelaFechada);
    return {
      externalMessageId: extrairWamid(response, "sendLocation"),
      raw: response,
    };
  }

  async sendContact(input: SendCanonicalContact): Promise<SendResult> {
    const response = await sendOfficialContact(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        organization: input.organization,
        email: input.email,
        replyToWamid: input.replyToExternalMessageId,
      },
    ).catch(relancarJanelaFechada);
    return {
      externalMessageId: extrairWamid(response, "sendContact"),
      raw: response,
    };
  }

  verifyWebhook(rawBody: string, headers: ProviderWebhookHeaders): boolean {
    // Sem App Secret não há o que validar: recusa, em vez de aceitar
    // qualquer corpo que chegue no endereço do webhook.
    if (!this.config.appSecret) return false;

    const assinatura =
      headers["x-hub-signature-256"] ?? headers["X-Hub-Signature-256"];
    return isMetaSignatureValid(
      rawBody,
      assinatura ?? null,
      this.config.appSecret,
    );
  }

  normalizeInbound(rawPayload: unknown): NormalizedInbound | null {
    const parsed = parseWhatsAppOfficialWebhook(rawPayload);
    if (!parsed) return null;

    const messages: CanonicalInboundMessage[] = [];
    const statusUpdates: CanonicalInboundStatusUpdate[] = [];

    for (const entry of parsed.entry) {
      for (const change of entry.changes) {
        const {
          metadata,
          contacts,
          messages: recebidas,
          statuses,
        } = change.value;

        // O nome do contato vem num array separado das mensagens; indexa por
        // `wa_id` para anexar como `displayName`.
        const nomePorWaId = new Map<string, string | undefined>();
        for (const contato of contacts ?? []) {
          nomePorWaId.set(contato.wa_id, contato.profile?.name);
        }

        for (const mensagem of recebidas ?? []) {
          messages.push(
            normalizarMensagem(
              mensagem,
              metadata,
              nomePorWaId.get(mensagem.from),
            ),
          );
        }
        for (const status of statuses ?? []) {
          statusUpdates.push(normalizarStatus(status));
        }
      }
    }

    return { messages, statusUpdates };
  }
}

const metaCloudBuilder: ProviderBuilder = (config: ProviderConfig) =>
  new MetaCloudProvider(metaCloudConfigSchema.parse(config));

registerProvider("meta-cloud", metaCloudBuilder);
