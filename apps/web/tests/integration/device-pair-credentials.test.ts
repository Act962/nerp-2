import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pairDeviceWithCredentials } from "@/app/router/device/pair-with-credentials";
import type { Organization } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth-verify";
import { createOrg, resetDb } from "./helpers";

const baseCtx = { context: { headers: new Headers() } };

function bearer(token: string): Request {
  return new Request("http://localhost/api/rpc", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("device.pairWithCredentials (Fase 1)", () => {
  let orgA: Organization;
  let userId: string;
  const email = `caixa-${Date.now()}@teste.local`;
  const password = "senha-de-teste-123";

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Rede A");

    // Cria um usuário COM senha via Better Auth (gera o hash no Account).
    const signup = await auth.api.signUpEmail({
      body: { email, password, name: "Operador Caixa" },
      headers: new Headers(),
    });
    userId = signup.user.id;
    await prisma.member.create({
      data: { organizationId: orgA.id, userId, role: "owner" },
    });
  });

  afterAll(resetDb);

  it("devolve um token válido para credenciais corretas", async () => {
    const result = await call(
      pairDeviceWithCredentials,
      { email, password, name: "Caixa 01", platform: "windows" },
      baseCtx,
    );

    expect(result.organizationId).toBe(orgA.id);
    expect(result.token).toBeTruthy();

    // O token devolvido autentica de fato como device da org A.
    const principal = await verifyDeviceAuth(bearer(result.token));
    expect(principal?.org.id).toBe(orgA.id);
    expect(principal?.user.id).toBe(userId);
  });

  it("recusa senha errada", async () => {
    await expect(
      call(
        pairDeviceWithCredentials,
        { email, password: "errada", name: "Caixa 02", platform: "windows" },
        baseCtx,
      ),
    ).rejects.toThrow();
  });

  it("recusa vincular a uma org da qual o usuário não é membro", async () => {
    const orgB = await createOrg("Rede B");
    await expect(
      call(
        pairDeviceWithCredentials,
        {
          email,
          password,
          name: "Caixa 03",
          platform: "windows",
          organizationId: orgB.id,
        },
        baseCtx,
      ),
    ).rejects.toThrow();
  });
});
