import "server-only";
import { X509Certificate } from "node:crypto";

/**
 * Data de expiração lida do próprio certificado.
 *
 * É o que alimenta o aviso de vencimento no card. Certificado vencido não dá
 * erro claro no provedor — a integração simplesmente para de responder, e
 * ninguém liga uma coisa na outra sem esse aviso.
 *
 * Devolve `null` para PEM ilegível: um certificado que não parseia vira erro no
 * teste de conexão, não no upload.
 */
export function lerValidade(pem: string): Date | null {
  try {
    const validade = new Date(new X509Certificate(pem).validTo);
    return Number.isNaN(validade.getTime()) ? null : validade;
  } catch {
    return null;
  }
}
