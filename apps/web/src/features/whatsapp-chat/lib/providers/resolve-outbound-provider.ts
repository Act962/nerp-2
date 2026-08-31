import "server-only";

import prisma from "@/lib/db";
import { modoDemoLigado } from "./adapters/demo/provider";
import { createProvider } from "./factory";
import {
  decryptStoredMetaCredentials,
  MetaCredentialsMissingError,
} from "./meta-credentials";
import {
  ConnectionNotFoundError,
  MetaCredentialsIncompleteError,
} from "./outbound-errors";
import type { ProviderId, WhatsAppChatProvider } from "./types";

/**
 * Resolve qual provedor usar para enviar mensagem por um funil.
 *
 * É o **único** lugar em que o caminho de envio toca credencial. Os handlers
 * pedem o provedor daqui e chamam `send*` — nenhum deles conhece a Meta.
 *
 * A busca é por `(funnelId, organizationId)`, não só pelo funil: a
 * organização vem do contexto autenticado e entra na consulta em vez de ser
 * assumida. Um `funnelId` que vaze de outro tenant não resolve nada.
 *
 * **Cache de 30 segundos, em memória.** Credencial quase nunca muda, e sem
 * cache cada mensagem enviada custaria uma consulta ao banco mais uma
 * decifragem AES. O preço é ficar com credencial velha por até 30 segundos
 * depois de uma troca — por isso quem grava credencial **precisa** chamar
 * `invalidateOutboundProvider`.
 */

const TTL_MS = 30_000;

export interface ResolvedOutboundProvider {
  readonly provider: WhatsAppChatProvider;
  readonly providerId: ProviderId;
  /** Id da linha de `WhatsAppConnection` — útil para log sem nova consulta. */
  readonly connectionId: string;
  readonly organizationId: string;
  readonly funnelId: string;
}

interface EntradaCache {
  resultado: ResolvedOutboundProvider;
  expiraEm: number;
}

const cache = new Map<string, EntradaCache>();

function chave(organizationId: string, funnelId: string): string {
  return `${organizationId}:${funnelId}`;
}

/**
 * Lança `ConnectionNotFoundError` quando o funil não tem número conectado, e
 * `MetaCredentialsIncompleteError` quando tem, mas sem credencial utilizável.
 */
export async function resolveOutboundProvider(input: {
  organizationId: string;
  funnelId: string;
}): Promise<ResolvedOutboundProvider> {
  const { organizationId, funnelId } = input;
  const agora = Date.now();
  const k = chave(organizationId, funnelId);

  const emCache = cache.get(k);
  if (emCache && emCache.expiraEm > agora) return emCache.resultado;
  if (emCache) cache.delete(k);

  // Modo demonstração: devolve o provedor dublado sem nem consultar
  // credencial. Serve para acompanhar o produto antes de existir conta na
  // Meta; a entrada continua real, pelo webhook assinado.
  if (modoDemoLigado()) {
    const resultado: ResolvedOutboundProvider = {
      provider: createProvider("demo", {}),
      providerId: "demo",
      connectionId: "demo",
      organizationId,
      funnelId,
    };
    cache.set(k, { resultado, expiraEm: agora + TTL_MS });
    return resultado;
  }

  const conexao = await prisma.whatsAppConnection.findFirst({
    where: { funnelId, organizationId },
    select: {
      id: true,
      organizationId: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  if (!conexao) throw new ConnectionNotFoundError(funnelId);

  let credenciais: ReturnType<typeof decryptStoredMetaCredentials>;
  try {
    credenciais = decryptStoredMetaCredentials(conexao);
  } catch (error) {
    if (error instanceof MetaCredentialsMissingError) {
      throw new MetaCredentialsIncompleteError(error.fields);
    }
    throw error;
  }

  const provider = createProvider("meta-cloud", {
    accessToken: credenciais.accessToken,
    phoneNumberId: credenciais.phoneNumberId,
    // O adapter aceita `appSecret` opcional: ele só é usado para verificar o
    // webhook, e o envio não passa por lá.
    ...(credenciais.appSecret ? { appSecret: credenciais.appSecret } : {}),
  });

  const resultado: ResolvedOutboundProvider = {
    provider,
    providerId: "meta-cloud",
    connectionId: conexao.id,
    organizationId: conexao.organizationId,
    funnelId,
  };

  cache.set(k, { resultado, expiraEm: agora + TTL_MS });
  return resultado;
}

/** Chame sempre que gravar credencial — senão o envio segue com a antiga. */
export function invalidateOutboundProvider(
  organizationId: string,
  funnelId: string,
): void {
  cache.delete(chave(organizationId, funnelId));
}

/** Zera tudo. Para quando a chave de cifra é rotacionada fora do fluxo normal. */
export function clearOutboundProviderCache(): void {
  cache.clear();
}
