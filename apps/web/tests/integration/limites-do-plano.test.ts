import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCustomer } from "@/app/router/customer/create";
import { createProduct } from "@/app/router/products/create";
import { LIMITES_A_PARTIR_DE } from "@/features/billing/server/plano-da-organizacao";
import {
  assertDentroDoLimite,
  contarRecurso,
  LimiteDoPlanoError,
  vagasRestantes,
} from "@/features/billing/server/limites";
import { PLANO_GRATIS } from "@/features/billing/lib/planos";
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
 * Limites de cadastro do plano Grátis.
 *
 * O que estes testes fixam: o 11º produto falha com um erro que o cliente
 * reconhece pelo código; dado de exemplo não conta; organização anterior ao
 * corte não tem limite; e o limite de uma organização nunca enxerga a outra.
 */

let org: Organization;
let dono: User;

const LIMITE = PLANO_GRATIS.limites.produtos ?? 0;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja no Grátis");
  dono = await createUser();
  await createMember(dono, org);
});

beforeEach(async () => {
  await prisma.product.deleteMany({ where: { organizationId: org.id } });
  await prisma.customer.deleteMany({ where: { organizationId: org.id } });
});

afterAll(resetDb);

async function criarProduto(nome: string) {
  return call(
    createProduct,
    { name: nome, salePrice: 10, costPrice: 5 },
    { context: s2sContext(dono, org) },
  );
}

describe("produtos no Grátis", () => {
  it(`aceita até ${LIMITE} e recusa o seguinte com LIMITE_DO_PLANO`, async () => {
    for (let i = 1; i <= LIMITE; i++) {
      await criarProduto(`Produto ${i}`);
    }
    expect(await contarRecurso(org.id, "produtos")).toBe(LIMITE);
    expect(await vagasRestantes(org.id, "produtos")).toBe(0);

    const erro = await criarProduto("Um a mais").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(LimiteDoPlanoError);
    const dados = (erro as LimiteDoPlanoError).data;
    expect(dados.code).toBe("LIMITE_DO_PLANO");
    expect(dados.recurso).toBe("produtos");
    expect(dados.limite).toBe(LIMITE);
    expect(dados.atual).toBe(LIMITE);
    expect(dados.plano).toBe(PLANO_GRATIS.nome);
  });

  it("dado de exemplo não ocupa vaga", async () => {
    await prisma.product.createMany({
      data: Array.from({ length: LIMITE }, (_, i) => ({
        organizationId: org.id,
        createdById: dono.id,
        name: `Exemplo ${i}`,
        slug: `exemplo-${i}`,
        salePrice: 1,
        isDemo: true,
      })),
    });

    expect(await contarRecurso(org.id, "produtos")).toBe(0);
    await expect(criarProduto("Meu primeiro produto")).resolves.toMatchObject({
      name: "Meu primeiro produto",
    });
  });

  it("um lote maior que as vagas é recusado antes de começar", async () => {
    await expect(
      assertDentroDoLimite(org.id, "produtos", LIMITE + 1),
    ).rejects.toBeInstanceOf(LimiteDoPlanoError);
    await expect(
      assertDentroDoLimite(org.id, "produtos", LIMITE),
    ).resolves.toBeUndefined();
  });
});

describe("clientes no Grátis", () => {
  it("o limite vale para clientes também", async () => {
    const limite = PLANO_GRATIS.limites.clientes ?? 0;
    for (let i = 1; i <= limite; i++) {
      await call(
        createCustomer,
        { name: `Cliente ${i}`, type: "FISICA" },
        { context: s2sContext(dono, org) },
      );
    }
    await expect(
      call(
        createCustomer,
        { name: "Cliente a mais", type: "FISICA" },
        { context: s2sContext(dono, org) },
      ),
    ).rejects.toBeInstanceOf(LimiteDoPlanoError);
  });
});

describe("quem não é Grátis", () => {
  it("organização anterior ao corte não tem limite", async () => {
    const antiga = await createOrg("Loja antiga");
    await prisma.organization.update({
      where: { id: antiga.id },
      data: { createdAt: new Date(LIMITES_A_PARTIR_DE.getTime() - 86_400_000) },
    });
    expect(await vagasRestantes(antiga.id, "produtos")).toBeNull();
    await expect(
      assertDentroDoLimite(antiga.id, "produtos", 10_000),
    ).resolves.toBeUndefined();
  });

  it("o limite de uma organização não enxerga os produtos da outra", async () => {
    const outra = await createOrg("Outra loja");
    const outroDono = await createUser();
    await createMember(outroDono, outra);
    await prisma.product.createMany({
      data: Array.from({ length: LIMITE }, (_, i) => ({
        organizationId: outra.id,
        createdById: outroDono.id,
        name: `Da outra ${i}`,
        slug: `da-outra-${i}`,
        salePrice: 1,
      })),
    });

    // A outra está cheia; esta continua vazia.
    expect(await vagasRestantes(outra.id, "produtos")).toBe(0);
    expect(await vagasRestantes(org.id, "produtos")).toBe(LIMITE);
  });
});
