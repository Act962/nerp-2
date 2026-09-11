import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBalance } from "@/app/router/stars/get-balance";
import type { Organization, User } from "@/generated/prisma/client";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * A chave de integração só alcança o que está em `s2s-scopes.ts`. Aqui a
 * negativa é exercitada com escopos de verdade; o `*` que a suíte usa por
 * padrão é o que deixa os outros testes chamarem qualquer procedure.
 */

let org: Organization;
let dono: User;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Org integrada");
  dono = await createUser();
  await createMember(dono, org);
});

afterAll(resetDb);

describe("escopos S2S", () => {
  it("chave sem escopo não lê nada fora do mapa, mesmo sendo do dono", async () => {
    await expect(
      call(getBalance, {}, { context: s2sContext(dono, org, []) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(getBalance, {}, { context: s2sContext(dono, org, ["pdv:read"]) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("o escopo total abre a procedure", async () => {
    const saldo = await call(
      getBalance,
      {},
      { context: s2sContext(dono, org, ["*"]) },
    );
    expect(saldo.saldo).toBe(0);
  });
});
