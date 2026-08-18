import "server-only";

import { Resend } from "resend";

const FALLBACK_FROM = "nasa@notifications.nasaex.com";

// Remetente dos e-mails transacionais da organização; precisa ser um endereço
// de domínio verificado no Resend. Lido em runtime para não congelar o valor
// no bundle de build.
export function organizationFrom(): string {
  return `NASA <${process.env.BETTER_AUTH_EMAIL ?? FALLBACK_FROM}>`;
}

let client: Resend | null = null;

// Lazy: sem a chave o import não pode quebrar o boot da app em dev.
export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY não configurada — não foi possível enviar o e-mail.",
    );
  }
  client ??= new Resend(apiKey);
  return client;
}
