import "server-only";
import z from "zod";
import { decryptSecret, encryptSecret } from "@/lib/nasa-s2s-crypto";

export type Credenciais = Record<string, string>;

const credenciaisSchema = z.record(z.string(), z.string());

export function cifrarCredenciais(valores: Credenciais): string {
  return encryptSecret(JSON.stringify(valores));
}

/** Falha alto: blob ilegível é chave de cifra trocada, não credencial vazia. */
export function decifrarCredenciais(ciphertext: string): Credenciais {
  return credenciaisSchema.parse(JSON.parse(decryptSecret(ciphertext)));
}

/** `••••4321` — a única forma de um segredo aparecer na tela. */
export function mascarar(valor: string): string {
  const limpo = valor.trim();
  return limpo.length <= 4 ? "••••" : `••••${limpo.slice(-4)}`;
}

const LIMITE_MENSAGEM = 300;

/**
 * Tira credencial do texto de erro antes de ele virar `lastSyncError` ou toast.
 *
 * Provedor devolve erro ecoando o header de autenticação com uma frequência
 * desconfortável, e esse campo é lido na tela e gravado no banco. Segredo curto
 * (< 8 caracteres) é ignorado de propósito: substituir cadeias curtas
 * embaralharia a mensagem inteira sem proteger nada.
 */
export function sanitizarErro(mensagem: string, segredos: string[]): string {
  let limpo = mensagem;
  for (const segredo of segredos) {
    const valor = segredo?.trim();
    if (!valor || valor.length < 8) continue;
    limpo = limpo.split(valor).join("••••");
  }
  // Pega também token que não veio da nossa lista (o que o provedor devolveu).
  limpo = limpo.replace(/(bearer|basic)\s+[\w.\-+/=]+/gi, "$1 ••••");
  return limpo.slice(0, LIMITE_MENSAGEM);
}
