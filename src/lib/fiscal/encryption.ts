import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

// AES-256-GCM para segredos fiscais (senha do certificado A1, tokens do
// provedor, CSC). O FORMATO persistido é `iv:tag:ciphertext`, tudo base64url,
// separado por ":".
//
// Chave-mestra vem de `FISCAL_ENCRYPTION_KEY` (env). Aceita:
//   - 32 bytes base64 (formato ideal, produção)
//   - Qualquer string com >= 16 chars — derivamos via scrypt (dev/local)
//
// Se a env estiver ausente, encrypt() FALHA (não silencia com fallback fraco).

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.FISCAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FISCAL_ENCRYPTION_KEY ausente. Gere com: `openssl rand -base64 32` e adicione ao .env.local (nunca commite).",
    );
  }
  // Tenta interpretar como base64 de 32 bytes; senão deriva com scrypt.
  const asBase64 = tryBase64(raw);
  cachedKey =
    asBase64 && asBase64.length === KEY_LEN
      ? asBase64
      : scryptSync(raw, "nerp-fiscal-v1", KEY_LEN);
  return cachedKey;
}

function tryBase64(s: string): Buffer | null {
  try {
    const b = Buffer.from(s.trim(), "base64");
    return b.length > 0 ? b : null;
  } catch {
    return null;
  }
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encryptString(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${b64url(iv)}:${b64url(tag)}:${b64url(ciphertext)}`;
}

export function decryptString(encoded: string | null | undefined): string {
  if (!encoded) return "";
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Formato criptografado inválido");
  const [ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const iv = fromB64url(ivB64);
  const tag = fromB64url(tagB64);
  const ciphertext = fromB64url(ctB64);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// Máscara "segura" pro client (nunca envia o token cru — mostra "•••• últimos 4").
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  const tail = value.slice(-4);
  return `•••• ${tail}`;
}
