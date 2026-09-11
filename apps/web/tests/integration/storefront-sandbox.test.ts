import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicSettingsCatalog } from "@/app/router/catalog/public";
import type { Organization } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, resetDb } from "./helpers";

/**
 * A vitrine pública só resolve organização verificada: uma sandbox com
 * subdomínio (mesmo que alguém o grave à mão) não vira loja no domínio da
 * plataforma.
 */

let verificada: Organization;
let sandbox: Organization;

beforeAll(async () => {
  await resetDb();
  verificada = await createOrg("Loja verificada");
  sandbox = await createOrg("Loja sandbox");
  await prisma.organization.update({
    where: { id: verificada.id },
    data: { subdomain: "loja-verificada", verifiedAt: new Date() },
  });
  await prisma.organization.update({
    where: { id: sandbox.id },
    data: { subdomain: "loja-sandbox", verifiedAt: null },
  });
});

afterAll(resetDb);

describe("catálogo público", () => {
  it("resolve a verificada e não a sandbox", async () => {
    const ok = await call(
      publicSettingsCatalog,
      { subdomain: "loja-verificada" },
      {
        context: { headers: new Headers() },
      },
    ).catch((e: unknown) => e);
    expect(ok).not.toMatchObject({ code: "NOT_FOUND" });

    const nao = await call(
      publicSettingsCatalog,
      { subdomain: "loja-sandbox" },
      {
        context: { headers: new Headers() },
      },
    ).catch((e: unknown) => e);
    expect(nao).toMatchObject({ code: "NOT_FOUND" });
  });
});
