import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkSubdomain } from "@/app/router/org/check-subdomain";
import { updateSubdomain } from "@/app/router/org/update-subdomain";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * O subdomínio é o endereço público da vitrine no domínio da plataforma:
 * só administrador troca, nome reservado nunca entra, e uma organização não
 * toma o endereço da outra.
 */

let orgA: Organization;
let orgB: Organization;
let donoA: User;
let membroA: User;

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Loja A");
  orgB = await createOrg("Loja B");
  donoA = await createUser();
  await createMember(donoA, orgA);
  membroA = await createUser();
  await prisma.member.create({
    data: { organizationId: orgA.id, userId: membroA.id, role: "member" },
  });
  await prisma.organization.update({
    where: { id: orgB.id },
    data: { subdomain: "loja-b-oficial" },
  });
});

afterAll(resetDb);

describe("org.updateSubdomain", () => {
  it("membro comum não troca o subdomínio", async () => {
    await expect(
      call(
        updateSubdomain,
        { subdomain: "loja-a" },
        { context: s2sContext(membroA, orgA) },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("administrador troca, e o valor é normalizado", async () => {
    const resultado = await call(
      updateSubdomain,
      { subdomain: "Loja-A" },
      { context: s2sContext(donoA, orgA) },
    );
    expect(resultado.subdomain).toBe("loja-a");
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { subdomain: true },
    });
    expect(org.subdomain).toBe("loja-a");
  });

  it("nome reservado é recusado", async () => {
    for (const reservado of ["www", "api", "login"]) {
      await expect(
        call(
          updateSubdomain,
          { subdomain: reservado },
          { context: s2sContext(donoA, orgA) },
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("não toma o subdomínio de outra organização", async () => {
    await expect(
      call(
        updateSubdomain,
        { subdomain: "loja-b-oficial" },
        { context: s2sContext(donoA, orgA) },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const b = await prisma.organization.findUniqueOrThrow({
      where: { id: orgB.id },
      select: { subdomain: true },
    });
    expect(b.subdomain).toBe("loja-b-oficial");
  });
});

describe("org.checkSubdomain", () => {
  it("diz indisponível para reservado, ocupado, e disponível para o próprio", async () => {
    const ctx = { context: s2sContext(donoA, orgA) };
    expect(
      (await call(checkSubdomain, { subdomain: "admin" }, ctx)).available,
    ).toBe(false);
    expect(
      (await call(checkSubdomain, { subdomain: "loja-b-oficial" }, ctx))
        .available,
    ).toBe(false);
    expect(
      (await call(checkSubdomain, { subdomain: "loja-a" }, ctx)).available,
    ).toBe(true);
  });
});
