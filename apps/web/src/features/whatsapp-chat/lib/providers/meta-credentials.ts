import "server-only";

import { mascarar } from "@/features/integracoes/server/credentials";
import { decryptAppSecret, encryptAppSecret } from "@/lib/crypto/app-secret";

/**
 * Credenciais da Meta guardadas em `WhatsAppConnection`.
 *
 * As colunas se dividem em duas classes, e a divisão é deliberada:
 *
 *  - **Segredos** (`metaAccessToken`, `metaAppSecret`, `metaVerifyToken`):
 *    cifrados com `APP_ENCRYPTION_KEY`. Para a tela vão mascarados
 *    (`••••1234`), nunca em claro.
 *
 *  - **Identificadores públicos** (`metaPhoneNumberId`,
 *    `metaBusinessAccountId`): texto puro. Eles aparecem em todo webhook que
 *    a Meta manda e na própria URL de envio; cifrar não esconderia nada e
 *    quebraria o `findUnique` que o webhook usa para descobrir de quem é a
 *    mensagem.
 */

export interface MetaCredentialsInput {
  readonly accessToken?: string | null;
  readonly phoneNumberId?: string | null;
  readonly appSecret?: string | null;
  readonly verifyToken?: string | null;
  readonly businessAccountId?: string | null;
}

/** O que está gravado na linha — segredos ainda cifrados. */
export interface MetaCredentialsStored {
  readonly metaAccessToken: string | null;
  readonly metaPhoneNumberId: string | null;
  readonly metaAppSecret: string | null;
  readonly metaVerifyToken: string | null;
  readonly metaBusinessAccountId: string | null;
}

/** O que pode atravessar a fronteira para o cliente. */
export interface MetaCredentialsMasked {
  readonly accessToken: string | null;
  readonly appSecret: string | null;
  readonly verifyToken: string | null;
  /** Público: a tela mostra inteiro para o operador conferir. */
  readonly phoneNumberId: string | null;
  /** Público. */
  readonly businessAccountId: string | null;
}

/**
 * Credenciais decifradas para uso no envio e no webhook.
 *
 * `appSecret` e `verifyToken` são anuláveis porque uma conexão feita pelo
 * fluxo de onboarding da Meta (Embedded Signup) não recebe os dois — nesse
 * caso o webhook cai no App Secret global do `.env`.
 */
export interface MetaCredentialsPlain {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly appSecret: string | null;
  readonly verifyToken: string | null;
  readonly businessAccountId: string | null;
}

export class MetaCredentialsMissingError extends Error {
  readonly fields: readonly string[];
  constructor(fields: readonly string[]) {
    super(
      `Credenciais da Meta ausentes: ${fields.join(", ")}. Reconecte o número em Configurações → WhatsApp.`,
    );
    this.name = "MetaCredentialsMissingError";
    this.fields = fields;
  }
}

/**
 * Formulário → `data` do update no Prisma.
 *
 *  - valor preenchido → grava (cifrado, se for segredo);
 *  - `null` → limpa a coluna (a tela pediu para zerar);
 *  - `undefined` → não mexe (a chave nem entra no `data`).
 *
 * A distinção entre `null` e `undefined` é o que permite salvar o formulário
 * sem redigitar os segredos: campo em branco chega como `undefined`.
 */
export function encryptMetaCredentialsInput(
  input: MetaCredentialsInput,
): Partial<MetaCredentialsStored> {
  const saida: Record<string, string | null> = {};
  if (input.accessToken !== undefined) {
    saida.metaAccessToken = cifrarSePreenchido(input.accessToken);
  }
  if (input.phoneNumberId !== undefined) {
    saida.metaPhoneNumberId = normalizarSePreenchido(input.phoneNumberId);
  }
  if (input.appSecret !== undefined) {
    saida.metaAppSecret = cifrarSePreenchido(input.appSecret);
  }
  if (input.verifyToken !== undefined) {
    saida.metaVerifyToken = cifrarSePreenchido(input.verifyToken);
  }
  if (input.businessAccountId !== undefined) {
    saida.metaBusinessAccountId = normalizarSePreenchido(
      input.businessAccountId,
    );
  }
  return saida as Partial<MetaCredentialsStored>;
}

/**
 * Formato seguro para a tela.
 *
 * Decifrar aqui é tolerante de propósito: se a chave de cifra foi trocada sem
 * recifrar o que estava guardado, o campo vira `••••` em vez de derrubar a
 * página inteira — o operador vê que algo está errado e ainda consegue
 * reconectar o número.
 */
export function maskMetaCredentials(
  stored: MetaCredentialsStored,
): MetaCredentialsMasked {
  return {
    accessToken: mascararSePresente(stored.metaAccessToken),
    appSecret: mascararSePresente(stored.metaAppSecret),
    verifyToken: mascararSePresente(stored.metaVerifyToken),
    phoneNumberId: stored.metaPhoneNumberId,
    businessAccountId: stored.metaBusinessAccountId,
  };
}

/**
 * Decifra para uso real. `accessToken` e `phoneNumberId` são obrigatórios —
 * sem eles não há envio nem roteamento de webhook, e não existe valor global
 * que sirva de reserva.
 */
export function decryptStoredMetaCredentials(
  stored: MetaCredentialsStored,
): MetaCredentialsPlain {
  const faltando: string[] = [];
  if (!stored.metaAccessToken) faltando.push("accessToken");
  if (!stored.metaPhoneNumberId) faltando.push("phoneNumberId");
  if (faltando.length > 0) throw new MetaCredentialsMissingError(faltando);

  return {
    accessToken: decryptAppSecret(stored.metaAccessToken),
    phoneNumberId: stored.metaPhoneNumberId as string,
    appSecret: stored.metaAppSecret
      ? decryptAppSecret(stored.metaAppSecret)
      : null,
    verifyToken: stored.metaVerifyToken
      ? decryptAppSecret(stored.metaVerifyToken)
      : null,
    businessAccountId: stored.metaBusinessAccountId,
  };
}

function cifrarSePreenchido(valor: string | null): string | null {
  if (valor === null) return null;
  const limpo = valor.trim();
  return limpo.length === 0 ? null : encryptAppSecret(limpo);
}

function normalizarSePreenchido(valor: string | null): string | null {
  if (valor === null) return null;
  const limpo = valor.trim();
  return limpo.length === 0 ? null : limpo;
}

function mascararSePresente(cifrado: string | null): string | null {
  if (!cifrado) return null;
  try {
    return mascarar(decryptAppSecret(cifrado));
  } catch {
    return "••••";
  }
}
