import "server-only";

import { randomUUID } from "node:crypto";
import { registerProvider } from "../../factory";
import type {
  NormalizedInbound,
  SendCanonicalContact,
  SendCanonicalLocation,
  SendCanonicalMedia,
  SendCanonicalTemplate,
  SendCanonicalText,
  SendResult,
  WhatsAppChatProvider,
} from "../../types";

/**
 * Provedor de demonstração — para acompanhar o produto sem credencial da Meta.
 *
 * Aceita qualquer envio, devolve um id sintético e **não fala com ninguém**. É
 * o suficiente para ver a bolha aparecer na conversa com o tique de enviada,
 * sem WhatsApp Business Account nem token.
 *
 * O que ele **não** faz, de propósito: nada da entrada. Mensagem recebida
 * continua chegando pelo webhook de verdade, com assinatura HMAC conferida e
 * passando pela pipeline real — é justamente o caminho onde mora o risco, e
 * dublar ali seria testar a dublagem.
 *
 * ## Por que é seguro
 *
 * Só existe quando `WHATSAPP_MODO_DEMO=true` **e** `NODE_ENV` não é produção.
 * As duas condições, não uma: a variável sozinha, esquecida num `.env` que
 * subiu, faria a loja achar que respondeu o cliente sem nunca ter respondido.
 */

export function modoDemoLigado(): boolean {
  return (
    process.env.WHATSAPP_MODO_DEMO === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

function idSintetico(): string {
  return `wamid.DEMO-${randomUUID()}`;
}

function resposta(operacao: string, input: unknown): SendResult {
  console.info(`[whatsapp:demo] ${operacao} (nada foi enviado de verdade)`, {
    input,
  });
  return { externalMessageId: idSintetico(), raw: { demo: true, operacao } };
}

export class DemoProvider implements WhatsAppChatProvider {
  readonly id = "demo" as const;

  async sendText(input: SendCanonicalText): Promise<SendResult> {
    return resposta("sendText", { to: input.to, body: input.body });
  }

  async uploadMedia(): Promise<{ mediaId: string }> {
    // No modo demo nada sai daqui: o id só precisa ser único para o envio
    // dublado logo em seguida não confundir dois arquivos.
    return { mediaId: `demo-media-${randomUUID()}` };
  }

  async sendMedia(input: SendCanonicalMedia): Promise<SendResult> {
    return resposta("sendMedia", { to: input.to, kind: input.mediaKind });
  }

  async sendLocation(input: SendCanonicalLocation): Promise<SendResult> {
    return resposta("sendLocation", { to: input.to });
  }

  async sendContact(input: SendCanonicalContact): Promise<SendResult> {
    return resposta("sendContact", { to: input.to });
  }

  async sendTemplate(input: SendCanonicalTemplate): Promise<SendResult> {
    return resposta("sendTemplate", {
      to: input.to,
      template: input.templateName,
    });
  }

  /** Recusa sempre: a entrada não passa por aqui, e fingir seria pior. */
  verifyWebhook(): boolean {
    return false;
  }

  normalizeInbound(): NormalizedInbound | null {
    return null;
  }
}

// Registro condicional: fora do modo demo o id "demo" simplesmente não existe,
// e pedir por ele estoura `UnknownProviderError`.
if (modoDemoLigado()) {
  console.warn(
    "[whatsapp:demo] MODO DEMONSTRAÇÃO LIGADO — nenhuma mensagem sai de verdade.",
  );
  registerProvider("demo", () => new DemoProvider());
}
