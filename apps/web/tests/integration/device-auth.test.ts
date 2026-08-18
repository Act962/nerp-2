import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pairDevice } from "@/app/router/device/pair";
import { listSupplier } from "@/app/router/supplier/list";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth-verify";
import { hashDeviceToken } from "@/lib/device-token";
import {
  createMember,
  createOrg,
  createUser,
  deviceContext,
  resetDb,
  s2sContext,
} from "./helpers";

function bearerRequest(token: string): Request {
  return new Request("http://localhost/api/rpc", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("device auth (Fase 0)", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let token: string;
  let deviceId: string;

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    userA = await createUser();
    await createMember(userA, orgA);

    await prisma.supplier.createMany({
      data: [
        { organizationId: orgA.id, name: "Indústria da A" },
        { organizationId: orgB.id, name: "Indústria da B" },
      ],
    });

    // Pareia um device no contexto autenticado do usuário em A.
    const paired = await call(
      pairDevice,
      { name: "Caixa 01", platform: "windows", scopes: [] },
      { context: s2sContext(userA, orgA) },
    );
    token = paired.token;
    deviceId = paired.deviceId;
  });

  afterAll(resetDb);

  it("guarda só o hash do token, nunca o token em claro", async () => {
    const device = await prisma.device.findUniqueOrThrow({
      where: { id: deviceId },
    });
    expect(device.tokenHash).toBe(hashDeviceToken(token));
    expect(device.tokenHash).not.toBe(token);
  });

  it("resolve o principal correto a partir do bearer", async () => {
    const principal = await verifyDeviceAuth(bearerRequest(token));
    expect(principal).not.toBeNull();
    expect(principal?.org.id).toBe(orgA.id);
    expect(principal?.user.id).toBe(userA.id);
  });

  it("recusa token inválido e token revogado", async () => {
    expect(await verifyDeviceAuth(bearerRequest("lixo-invalido"))).toBeNull();
    expect(
      await verifyDeviceAuth(new Request("http://localhost/api/rpc")),
    ).toBeNull();

    await prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
    expect(await verifyDeviceAuth(bearerRequest(token))).toBeNull();

    // reativa para os próximos testes
    await prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: null },
    });
  });

  it("escopa as queries à org do device — não vaza outra organização", async () => {
    const result = await call(
      listSupplier,
      { page: 1, pageSize: 10 },
      { context: deviceContext(userA, orgA) },
    );
    expect(result.suppliers.map((supplier) => supplier.name)).toEqual([
      "Indústria da A",
    ]);
    expect(result.totalCount).toBe(1);
  });
});
