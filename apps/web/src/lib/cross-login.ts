import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificação do token de "login cross-app" NASA → NERP.
 *
 * Espelho de `nasa.ex/src/features/sync/lib/cross-login-token.ts`. O NASA assina
 * `${base64url(JSON{userId,exp})}.${HMAC-SHA256(payloadB64)}` com a credencial de
 * sistema `SYNC_SHARED_SECRET` (mesma do sync). Aqui só validamos assinatura +
 * expiração — stateless, sem banco, sem nonce (TTL curto basta).
 */

function getSharedSecret(): string {
  const s = process.env.SYNC_SHARED_SECRET;
  if (!s) {
    throw new Error(
      "Missing env SYNC_SHARED_SECRET. Generate with 'openssl rand -hex 32'.",
    );
  }
  return s;
}

function hexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCrossLoginToken(
  token: string,
): { userId: string } | null {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    const expected = createHmac("sha256", getSharedSecret())
      .update(payloadB64)
      .digest("hex");
    if (!hexEqual(expected, signature)) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { userId?: unknown; exp?: unknown };

    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;

    return { userId: payload.userId };
  } catch {
    return null;
  }
}
