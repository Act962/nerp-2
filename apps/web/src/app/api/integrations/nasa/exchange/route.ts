import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import prisma from "@/lib/db";
import { encryptSecret } from "@/lib/nasa-s2s-crypto";

const bodySchema = z.object({
  code: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const expectedId = process.env.NASA_CLIENT_ID;
  const expectedSecret = process.env.NASA_CLIENT_SECRET;
  if (!expectedId || !expectedSecret) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }
  if (
    !safeEqual(body.clientId, expectedId) ||
    !safeEqual(body.clientSecret, expectedSecret)
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  const consent = await prisma.nasaIntegrationConsent.findUnique({
    where: { code: body.code },
  });
  if (!consent) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (consent.consumedAt) {
    return NextResponse.json({ error: "code_already_used" }, { status: 400 });
  }
  if (consent.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }

  const apiKey = `nerp_live_${randomBytes(24).toString("base64url")}`;
  const secret = randomBytes(32).toString("base64url");
  const secretCiphertext = encryptSecret(secret);

  await prisma.$transaction([
    prisma.nasaIntegrationConsent.update({
      where: { id: consent.id },
      data: { consumedAt: new Date() },
    }),
    prisma.nasaIntegrationKey.create({
      data: {
        organizationId: consent.nerpOrgId,
        apiKey,
        secretCiphertext,
        scopes: consent.scopes,
        consentByUserId: consent.userId,
      },
    }),
  ]);

  return NextResponse.json({
    apiKey,
    secret,
    nerpOrgId: consent.nerpOrgId,
    scopes: consent.scopes,
    expiresAt: null,
  });
}
