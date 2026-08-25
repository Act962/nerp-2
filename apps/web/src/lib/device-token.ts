import { createHash, randomBytes } from "node:crypto";

/**
 * Token de dispositivo: opaco, alta entropia. Mesmo padrão do `share-token.ts`
 * (`randomBytes(32).base64url`). Devolvido UMA vez no pareamento e guardado no
 * keychain do device — nunca persistido em claro do lado do servidor.
 */
export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Só o hash é gravado (coluna `Device.tokenHash`). Vazou o banco, não vaza
 * token utilizável. sha256 basta: o token já é aleatório de 256 bits, então
 * não há dicionário a proteger — é lookup, não verificação de senha.
 */
export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
