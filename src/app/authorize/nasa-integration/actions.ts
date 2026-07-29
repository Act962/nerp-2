"use server";

import { randomBytes } from "node:crypto";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

const CONSENT_TTL_MS = 10 * 60 * 1000;

type AuthorizeParams = {
  state: string;
  redirectUri: string;
  scopes: string;
};

export async function approveNasaIntegration(params: AuthorizeParams) {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user) {
    throw new Error("not_authenticated");
  }

  const org = await auth.api.getFullOrganization({
    headers: await nextHeaders(),
  });
  if (!org) {
    throw new Error("no_active_org");
  }

  const code = randomBytes(24).toString("base64url");
  await prisma.nasaIntegrationConsent.create({
    data: {
      code,
      nerpOrgId: org.id,
      userId: session.user.id,
      scopes: params.scopes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      redirectUri: params.redirectUri,
      expiresAt: new Date(Date.now() + CONSENT_TTL_MS),
    },
  });

  const url = new URL(params.redirectUri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", params.state);
  redirect(url.toString());
}

export async function denyNasaIntegration(params: {
  state: string;
  redirectUri: string;
}) {
  const url = new URL(params.redirectUri);
  url.searchParams.set("error", "user_denied");
  url.searchParams.set("state", params.state);
  redirect(url.toString());
}
