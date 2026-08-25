import { createHmac, timingSafeEqual } from "node:crypto";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "./db";
import { decryptSecret } from "./nasa-s2s-crypto";

const DRIFT_MS = 5 * 60 * 1000;
const API_KEY_HEADER = "x-nerp-api-key";
const ORG_ID_HEADER = "x-nerp-org-id";
const TIMESTAMP_HEADER = "x-nerp-timestamp";
const SIGNATURE_HEADER = "x-nerp-signature";

export type S2SContext = {
  org: Organization;
  user: User;
  scopes: string[];
};

function hexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function verifyNasaS2S(
  request: Request,
): Promise<S2SContext | null> {
  const apiKey = request.headers.get(API_KEY_HEADER);
  if (!apiKey) return null;

  const orgIdHeader = request.headers.get(ORG_ID_HEADER);
  const timestampHeader = request.headers.get(TIMESTAMP_HEADER);
  const signatureHeader = request.headers.get(SIGNATURE_HEADER);

  if (!orgIdHeader || !timestampHeader || !signatureHeader) {
    throw new Response(JSON.stringify({ error: "missing_s2s_headers" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > DRIFT_MS) {
    throw new Response(JSON.stringify({ error: "timestamp_drift" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const key = await prisma.nasaIntegrationKey.findUnique({
    where: { apiKey },
    select: {
      id: true,
      organizationId: true,
      secretCiphertext: true,
      revokedAt: true,
      scopes: true,
      consentByUserId: true,
    },
  });
  if (!key || key.revokedAt) {
    throw new Response(JSON.stringify({ error: "invalid_key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  if (key.organizationId !== orgIdHeader) {
    throw new Response(JSON.stringify({ error: "org_mismatch" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let secret: string;
  try {
    secret = decryptSecret(key.secretCiphertext);
  } catch {
    throw new Response(JSON.stringify({ error: "decrypt_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const rawBody = await request.clone().text();
  const url = new URL(request.url);
  const canonical = `${request.method.toUpperCase()}\n${url.pathname}\n${rawBody}\n${timestampHeader}`;
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");

  if (!hexEqual(expected, signatureHeader)) {
    throw new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const [org, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: key.organizationId } }),
    prisma.user.findUnique({ where: { id: key.consentByUserId } }),
  ]);
  if (!org) {
    throw new Response(JSON.stringify({ error: "org_not_found" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  if (!user) {
    throw new Response(JSON.stringify({ error: "consent_user_not_found" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  prisma.nasaIntegrationKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { org, user, scopes: key.scopes };
}
