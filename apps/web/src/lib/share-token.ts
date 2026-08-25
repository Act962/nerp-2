import { randomBytes } from "node:crypto";

// Token de link público (catálogo PDV). Precisa ser IMPREVISÍVEL, não só único:
// é a única barreira entre um link solto e a tabela de preços de trade da org.
// 32 bytes -> 43 chars base64url, seguros em URL e sem depender de timestamp
// nem de contador sequencial como o cuid.
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
