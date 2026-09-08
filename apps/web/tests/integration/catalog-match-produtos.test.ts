import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOfferProducts } from "@/app/router/promotional-catalog/create-offer-products";
import { matchProductsByName } from "@/app/router/promotional-catalog/match-products-by-name";
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
 * Regressão do encarte "SET 08 A 20.09" (set/2026): a planilha trazia estes 17
 * nomes, todos JÁ cadastrados, e a importação casou 3 — o resto virou "novo" e
 * duplicou o cadastro. A chave de busca era normalizada (sem acento nem
 * pontuação) mas comparada com `contains` contra a coluna crua do Postgres.
 */
const NOMES = [
  "Achocolatado - 3Corações - Refil - 370g",
  "Achocolatado - 3Corações - Refil - 400G",
  "Achocolatado - 3Corações - Refil - 560G",
  "Achocolatado - 3Corações - Refil - 700G",
  "Café Leite 3C 300 gr",
  "Café Leite Sc 300 gr",
  "Café Leite Sc 330 gr",
  "Cafes - Café Santa Clara Extra Forte 250G",
  "Cappuccino - Santa Clara - Pote - 200G",
  "Cappuccino pronto - Pronto - POWER WAY",
  "Capsula - Tres",
  "Flocao Milho Dona Clara 500g",
  "Leite Vegetal",
  "Refresco - Frisco - Tradicional",
  "Soluveis - Kimimo - Refil - 40G",
  "Soluveis - Santa Clara - Refil - 40G",
];

describe("promotionalCatalog.matchProductsByName", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    userA = await createUser();
    await createMember(userA, orgA);

    await prisma.product.createMany({
      data: NOMES.map((name, i) => ({
        organizationId: orgA.id,
        createdById: userA.id,
        name,
        slug: `a-${i}`,
        salePrice: 10,
        images: [],
        thumbnail: `thumb/${i}.jpg`,
      })),
    });
    // Mesmo nome na outra org: o casamento não pode alcançá-lo.
    await prisma.product.create({
      data: {
        organizationId: orgB.id,
        createdById: userA.id,
        name: "Cafes - Café Santa Clara Extra Forte 250G",
        slug: "b-0",
        salePrice: 10,
        images: [],
        thumbnail: "thumb/b.jpg",
      },
    });
  });

  afterAll(resetDb);

  it("casa os 17 nomes da planilha com o cadastro", async () => {
    const result = await call(
      matchProductsByName,
      { items: NOMES.map((name) => ({ name })) },
      { context: s2sContext(userA, orgA) },
    );

    expect(result).toHaveLength(NOMES.length);
    for (const row of result) {
      expect(row.productId, row.name).not.toBeNull();
      expect(row.matchedName, row.name).toBe(row.name);
      expect(row.source, row.name).toBe("name-exact");
      expect(row.thumbnail, row.name).toBeTruthy();
    }
  });

  it("não casa produto de outra organização", async () => {
    const doOrgA = await prisma.product.findMany({
      where: { organizationId: orgA.id },
      select: { id: true },
    });
    const idsDaOrgA = new Set(doOrgA.map((p) => p.id));

    const result = await call(
      matchProductsByName,
      { items: [{ name: "Cafes - Café Santa Clara Extra Forte 250G" }] },
      { context: s2sContext(userA, orgA) },
    );

    expect(result[0].productId).not.toBeNull();
    expect(idsDaOrgA.has(result[0].productId ?? "")).toBe(true);
  });

  it("distingue as gramaturas do mesmo achocolatado", async () => {
    const variacoes = NOMES.filter((n) => n.startsWith("Achocolatado"));
    const result = await call(
      matchProductsByName,
      { items: variacoes.map((name) => ({ name })) },
      { context: s2sContext(userA, orgA) },
    );

    expect(result.map((r) => r.matchedName)).toEqual(variacoes);
  });

  it("produto que não existe continua sem casamento", async () => {
    const result = await call(
      matchProductsByName,
      { items: [{ name: "Biscoito Recheado Morango 130G" }] },
      { context: s2sContext(userA, orgA) },
    );

    expect(result[0].productId).toBeNull();
    expect(result[0].source).toBeNull();
  });
});

describe("promotionalCatalog.createOfferProducts", () => {
  let org: Organization;
  let user: User;

  beforeAll(async () => {
    await resetDb();
    org = await createOrg("Rede C");
    user = await createUser();
    await createMember(user, org);
    await prisma.product.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        name: "Achocolatado - 3Corações - Refil - 700G",
        slug: "c-0",
        salePrice: 14.99,
        images: [],
        thumbnail: "",
      },
    });
  });

  afterAll(resetDb);

  it("reaproveita o produto existente em vez de duplicar por caixa/acento", async () => {
    const result = await call(
      createOfferProducts,
      {
        products: [
          // Mesmo produto, escrito com "g" minúsculo — como veio da planilha.
          { name: "Achocolatado - 3Corações - Refil - 700g", salePrice: 14.99 },
          { name: "Produto Realmente Novo 1KG", salePrice: 9.9 },
          // Repetido dentro do próprio lote.
          { name: "Produto Realmente Novo 1KG", salePrice: 9.9 },
        ],
      },
      { context: s2sContext(user, org) },
    );

    expect(result.map((r) => r.reused)).toEqual([true, false, true]);
    expect(result[1].productId).toBe(result[2].productId);
    expect(result.every((r) => r.error === null)).toBe(true);

    const total = await prisma.product.count({
      where: { organizationId: org.id },
    });
    expect(total).toBe(2);
  });
});
