import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pairDevice } from "@/app/router/device/pair";
import { openCaixaFromDevice } from "@/app/router/caixa/open-from-device";
import { pullProducts } from "@/app/router/products/pull";
import { listSupplier } from "@/app/router/supplier/list";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { verifyDeviceAuth } from "@/lib/device-auth-verify";
import { DEFAULT_DEVICE_SCOPES } from "@/lib/device-scopes";
import { hashDeviceToken } from "@/lib/device-token";
import {
  createMember,
  createOrg,
  createUser,
  deviceOptions,
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
      { name: "Caixa 01", platform: "windows" },
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

  it("nasce com os escopos de PDV, não com acesso ao router inteiro", async () => {
    const device = await prisma.device.findUniqueOrThrow({
      where: { id: deviceId },
    });
    expect(device.scopes).toEqual(DEFAULT_DEVICE_SCOPES);
  });

  it("derruba o token quando o usuário deixa de ser membro da org", async () => {
    expect(await verifyDeviceAuth(bearerRequest(token))).not.toBeNull();

    const member = await prisma.member.findFirstOrThrow({
      where: { userId: userA.id, organizationId: orgA.id },
    });
    await prisma.member.delete({ where: { id: member.id } });

    expect(await verifyDeviceAuth(bearerRequest(token))).toBeNull();

    // devolve o vínculo para os próximos testes
    await createMember(userA, orgA);
  });

  it("não alcança procedure fora do contrato do desktop (fail-closed)", async () => {
    // `supplier.list` é uma procedure comum do ERP: um token de terminal NÃO
    // pode chegar nela só por estar autenticado. Sem o guard de escopo, este
    // call retornaria a lista — era o vazamento que ele fecha.
    await expect(
      call(
        listSupplier,
        { page: 1, pageSize: 10 },
        deviceOptions(userA, orgA, ["supplier", "list"]),
      ),
      // FORBIDDEN explícito: um NOT_FOUND/validação aqui passaria pelo
      // `toThrow()` genérico e esconderia o guard tendo deixado de rodar.
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("recusa a procedure quando falta o escopo dela ao device", async () => {
    // Terminal só-consulta: tem `pdv:sync`, então puxa catálogo…
    const pull = await call(
      pullProducts,
      { updatedAt: null, id: null, limit: 10 },
      deviceOptions(userA, orgA, ["products", "pull"], ["pdv:sync"]),
    );
    expect(pull.products).toBeDefined();

    // …mas não abre caixa, que exige `pdv:caixa`.
    await expect(
      call(
        openCaixaFromDevice,
        { operationId: "s-x", openingBalance: 0, registerName: "Caixa X" },
        deviceOptions(userA, orgA, ["caixa", "openFromDevice"], ["pdv:sync"]),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("escopa as queries à org do device — não vaza outra organização", async () => {
    // Mesma garantia de antes, agora por uma procedure que o device PODE
    // chamar. Os DOIS lados importam: sem o produto em A, um `pull` que
    // regredisse para devolver nada passaria como se estivesse isolando.
    for (const [org, name] of [
      [orgA, "Produto da A"],
      [orgB, "Produto da B"],
    ] as const) {
      await prisma.product.create({
        data: {
          organizationId: org.id,
          name,
          slug: `p-${Math.random().toString(36).slice(2)}`,
          salePrice: 5,
          createdById: userA.id,
        },
      });
    }

    const result = await call(
      pullProducts,
      { updatedAt: null, id: null, limit: 100 },
      deviceOptions(userA, orgA, ["products", "pull"]),
    );

    expect(result.products.map((p) => p.name)).toEqual(["Produto da A"]);
  });
});
