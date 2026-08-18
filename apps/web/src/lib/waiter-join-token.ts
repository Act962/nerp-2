import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de "auto-join" do app do garçom.
 *
 * O QR do app do garçom carrega um token assinado que autoriza um usuário a
 * entrar (virar Member) numa organização existente. Diferente do slug — que é
 * visível no QR e "chutável" — o token é assinado com HMAC `SYNC_SHARED_SECRET`
 * e expira, então só quem recebe o QR consegue se juntar à org. Mesma primitiva
 * do cross-login (`./cross-login.ts`), mas aqui o NERP também ASSINA (não só
 * verifica).
 *
 * Formato: `${base64url(JSON{orgId,role,exp})}.${HMAC-SHA256(payloadB64)}`.
 * Stateless: sem banco/nonce — TTL curto basta (não há revogação individual).
 */

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Roles aceitas num join via QR. Nunca permitir "owner"/"admin" por token.
const ALLOWED_ROLES = ["member"] as const;
type WaiterJoinRole = (typeof ALLOWED_ROLES)[number];

export interface WaiterJoinPayload {
  orgId: string;
  role: WaiterJoinRole;
}

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

function sign(payloadB64: string): string {
  return createHmac("sha256", getSharedSecret())
    .update(payloadB64)
    .digest("hex");
}

function normalizeRole(role: unknown): WaiterJoinRole {
  return ALLOWED_ROLES.includes(role as WaiterJoinRole)
    ? (role as WaiterJoinRole)
    : "member";
}

export function signWaiterJoinToken(
  input: { orgId: string; role?: string },
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload = {
    orgId: input.orgId,
    role: normalizeRole(input.role),
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyWaiterJoinToken(token: string): WaiterJoinPayload | null {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;
    if (!hexEqual(sign(payloadB64), signature)) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { orgId?: unknown; role?: unknown; exp?: unknown };

    if (typeof payload.orgId !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;

    return { orgId: payload.orgId, role: normalizeRole(payload.role) };
  } catch {
    return null;
  }
}
