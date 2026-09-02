import "server-only";

import prisma from "@/lib/db";
import {
  decryptStoredMetaCredentials,
  MetaCredentialsMissingError,
} from "./providers/meta-credentials";

/**
 * Descobre de quem é a mensagem que chegou.
 *
 * A Meta não deixa colocar querystring na URL do webhook: o endpoint é um só
 * para a plataforma inteira, e o único identificador que vem no payload é
 * `metadata.phone_number_id`. Por isso `metaPhoneNumberId` é texto puro e
 * único no schema — este lookup roda a cada evento recebido e precisa ser um
 * índice, não uma varredura decifrando candidatos.
 *
 * É aqui que a organização entra na história: tudo que a pipeline fizer
 * depois herda o `organizationId` desta linha, e não de nada que veio no
 * payload.
 */
export interface ConexaoDoWebhook {
  readonly connectionId: string;
  readonly organizationId: string;
  readonly funnelId: string;
  readonly accessToken: string;
  readonly phoneNumberId: string;
  /** `null` quando a conexão veio do onboarding da Meta — cai no App Secret global. */
  readonly appSecret: string | null;
}

export async function getConnectionByMetaPhoneNumberId(
  phoneNumberId: string,
): Promise<ConexaoDoWebhook | null> {
  const conexao = await prisma.whatsAppConnection.findUnique({
    where: { metaPhoneNumberId: phoneNumberId },
    select: {
      id: true,
      organizationId: true,
      funnelId: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  if (!conexao) return null;

  try {
    const credenciais = decryptStoredMetaCredentials(conexao);
    return {
      connectionId: conexao.id,
      organizationId: conexao.organizationId,
      funnelId: conexao.funnelId,
      accessToken: credenciais.accessToken,
      phoneNumberId: credenciais.phoneNumberId,
      appSecret: credenciais.appSecret,
    };
  } catch (error) {
    // Linha existe mas está sem credencial utilizável (ou a chave de cifra
    // mudou). Tratamos como "não encontrada" para o webhook responder 401 em
    // vez de estourar — e logamos, porque isso é erro de configuração nosso.
    console.error("[whatsapp:webhook] credencial_ilegivel", {
      connectionId: conexao.id,
      campos:
        error instanceof MetaCredentialsMissingError ? error.fields : undefined,
    });
    return null;
  }
}
