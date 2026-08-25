import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifySyncRequest } from "@/lib/sync-system-cred";
import type {
  SyncAccountPayload,
  SyncEnvelope,
  SyncMemberPayload,
  SyncOrgPayload,
  SyncUserPayload,
} from "@/lib/sync-payloads";

/**
 * Endpoint INBOUND do sync de auth: NASA → NERP.
 *
 * INVARIANTE: este caminho NUNCA usa APIs do better-auth — só Prisma cru. Não
 * dispara hooks → não há eco/loop. Todo upsert é por `id` (idempotente).
 *
 * Respostas:
 *  - 200 → aplicado (ou pulado por colisão de identidade, logado).
 *  - 401 → assinatura inválida.
 *  - 409 `{ retryable: true }` → pré-requisito ausente (FK). O remoto reenfileira.
 */
export async function POST(request: Request) {
  const ok = await verifySyncRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let envelope: SyncEnvelope;
  try {
    envelope = (await request.json()) as SyncEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    switch (envelope.type) {
      case "user":
        return await upsertUser(envelope.data);
      case "account":
        return await upsertAccount(envelope.data);
      case "org":
        return await upsertOrg(envelope.data);
      case "member":
        return await upsertMember(envelope.data);
      default:
        return NextResponse.json({ error: "unknown_type" }, { status: 400 });
    }
  } catch (e) {
    console.error("[sync inbound nasa] upsert failed:", e);
    return NextResponse.json(
      { error: "internal", retryable: true },
      { status: 500 },
    );
  }
}

function d(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

async function upsertUser(p: SyncUserPayload) {
  const existingByEmail = await prisma.user.findUnique({
    where: { email: p.email },
    select: { id: true },
  });
  if (existingByEmail && existingByEmail.id !== p.id) {
    console.warn(
      `[sync inbound nasa] user email collision: ${p.email} (incoming ${p.id} != local ${existingByEmail.id}) — skipping`,
    );
    return NextResponse.json({ ok: true, skipped: "email_collision" });
  }

  // NERP User não tem `phone`; demais campos são comuns.
  const data = {
    name: p.name,
    email: p.email,
    emailVerified: p.emailVerified,
    image: p.image,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
  await prisma.user.upsert({
    where: { id: p.id },
    create: { id: p.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}

async function upsertAccount(p: SyncAccountPayload) {
  const user = await prisma.user.findUnique({
    where: { id: p.userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "user_not_found", retryable: true },
      { status: 409 },
    );
  }

  const data = {
    accountId: p.accountId,
    providerId: p.providerId,
    userId: p.userId,
    accessToken: p.accessToken,
    refreshToken: p.refreshToken,
    idToken: p.idToken,
    accessTokenExpiresAt: d(p.accessTokenExpiresAt),
    refreshTokenExpiresAt: d(p.refreshTokenExpiresAt),
    scope: p.scope,
    password: p.password,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
  await prisma.account.upsert({
    where: { id: p.id },
    create: { id: p.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}

async function upsertOrg(p: SyncOrgPayload) {
  // NERP exige `slug` e `subdomain` únicos. Como a slug do NASA não é única,
  // pode colidir aqui — colisão com id diferente → loga e pula.
  const [bySlug, bySubdomain] = await Promise.all([
    prisma.organization.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    }),
    prisma.organization.findUnique({
      where: { subdomain: p.slug },
      select: { id: true },
    }),
  ]);
  if (
    (bySlug && bySlug.id !== p.id) ||
    (bySubdomain && bySubdomain.id !== p.id)
  ) {
    console.warn(
      `[sync inbound nasa] org slug/subdomain collision: ${p.slug} (incoming ${p.id}) — skipping`,
    );
    return NextResponse.json({ ok: true, skipped: "slug_collision" });
  }

  // Espelha o hook afterCreateOrganization do NERP (subdomain = slug).
  const data = {
    name: p.name,
    slug: p.slug,
    subdomain: p.slug,
    logo: p.logo,
    metadata: p.metadata,
    createdAt: new Date(p.createdAt),
  };
  await prisma.organization.upsert({
    where: { id: p.id },
    create: { id: p.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}

async function upsertMember(p: SyncMemberPayload) {
  const [org, user] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: p.organizationId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: p.userId },
      select: { id: true },
    }),
  ]);
  if (!org || !user) {
    return NextResponse.json(
      { error: "prerequisite_missing", retryable: true },
      { status: 409 },
    );
  }

  const existingPair = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: p.organizationId,
        userId: p.userId,
      },
    },
    select: { id: true },
  });
  if (existingPair && existingPair.id !== p.id) {
    console.warn(
      `[sync inbound nasa] member pair collision (incoming ${p.id} != local ${existingPair.id}) — skipping`,
    );
    return NextResponse.json({ ok: true, skipped: "member_collision" });
  }

  const data = {
    organizationId: p.organizationId,
    userId: p.userId,
    role: p.role,
    createdAt: new Date(p.createdAt),
  };
  await prisma.member.upsert({
    where: { id: p.id },
    create: { id: p.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
