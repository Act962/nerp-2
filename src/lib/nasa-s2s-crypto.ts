import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_ENV = "NASA_S2S_ENCRYPTION_KEY";

function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(
      `Missing env ${KEY_ENV}. Generate with 'openssl rand -hex 32'.`,
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must decode to 32 bytes (64 hex chars).`);
  }
  return key;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64url(iv)}.${b64url(tag)}.${b64url(ct)}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivPart, tagPart, ctPart] = payload.split(".");
  if (!ivPart || !tagPart || !ctPart) {
    throw new Error("Malformed ciphertext payload");
  }
  const iv = fromB64url(ivPart);
  const tag = fromB64url(tagPart);
  const ct = fromB64url(ctPart);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}
