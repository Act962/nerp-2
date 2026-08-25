import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listSupplier } from "@/app/router/supplier/list";
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
 * Molde para os testes de procedure.
 *
 * O que ele protege é a regra mais frágil do projeto: o escopo por organização
 * é MANUAL em cada handler — não há RLS nem extensão do Prisma. Um `findMany`
 * sem `organizationId` vaza dados de outro inquilino sem quebrar nada visível
 * (foi exatamente o IDOR corrigido em 90cd7d6). Replique este arquivo procedure
 * a procedure: duas orgs, dados nas duas, asserção de que uma não vê a outra.
 */
describe("supplier.list", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;

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
  });

  afterAll(resetDb);

  it("devolve só os fornecedores da organização do contexto", async () => {
    const result = await call(
      listSupplier,
      { page: 1, pageSize: 10 },
      {
        context: s2sContext(userA, orgA),
      },
    );

    expect(result.suppliers.map((s) => s.name)).toEqual(["Indústria da A"]);
    expect(result.totalCount).toBe(1);
  });

  it("não vaza fornecedor de outra organização nem com busca pelo nome exato", async () => {
    const result = await call(
      listSupplier,
      { page: 1, pageSize: 10, search: "Indústria da B" },
      { context: s2sContext(userA, orgA) },
    );

    expect(result.suppliers).toHaveLength(0);
  });
});
