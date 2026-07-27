import { createHmac, timingSafeEqual } from "node:crypto";

// Token bearer leve do shopper: `<shopperId>.<hmac>`. Sem cookie/sessão própria
// por enquanto — a integridade vem do HMAC (o cliente não forja outro id sem o
// segredo). Evolução: cookie httpOnly + expiração. Server-only.
const SECRET =
  process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "dev-secret";

function sign(shopperId: string): string {
  return createHmac("sha256", SECRET).update(shopperId).digest("base64url");
}

export function signShopperToken(shopperId: string): string {
  return `${shopperId}.${sign(shopperId)}`;
}

export function verifyShopperToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const shopperId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(shopperId);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return shopperId;
}
