import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Token do link aberto de entrada na organização.
 *
 * Precisa ser IMPREVISÍVEL, não só único: é a única barreira entre uma URL
 * solta num grupo de WhatsApp e alguém virando membro da empresa. 32 bytes →
 * 43 chars base64url, seguros em URL e sem depender de contador sequencial
 * como o cuid. Mesmo critério do `generateShareToken` do catálogo público.
 */
export function generateJoinToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * URL absoluta do convite.
 *
 * Usa `BETTER_AUTH_URL`, e não o `window.location.origin` de quem está
 * gerando: o cookie de sessão é host-only, então o link precisa apontar para
 * a origem que emite a sessão — um admin acessando por subdomínio geraria um
 * link que quebra o login de quem clicar.
 */
export function buildJoinLink(token: string): string {
  const baseOrigin = (
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${baseOrigin}/entrar/${token}`;
}
