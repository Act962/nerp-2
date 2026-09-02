import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchProductsForPdv } from "@/app/router/products/search-pdv";
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
 * A busca da grade do PDV.
 *
 * O que estes testes protegem é a aritmética dos dois baldes: quem COMEÇA com
 * o termo vem antes de quem só o contém, e a página de transição precisa
 * emendar o fim do primeiro balde com o começo do segundo sem repetir nem
 * pular ninguém.
 */

let orgA: Organization;
let orgB: Organization;
let userA: User;

async function criarProduto(
  org: Organization,
  dono: User,
  name: string,
  extra: { sku?: string; barcode?: string } = {},
) {
  return prisma.product.create({
    data: {
      organizationId: org.id,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      salePrice: 10,
      createdById: dono.id,
      ...extra,
    },
    select: { id: true },
  });
}

const nomes = (result: { products: { name: string }[] }) =>
  result.products.map((product) => product.name);

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Rede A");
  orgB = await createOrg("Rede B");
  userA = await createUser();
  const userB = await createUser();
  await createMember(userA, orgA);
  await createMember(userB, orgB);

  // Dois que COMEÇAM com "queijo" e dois que só contêm.
  await criarProduto(orgA, userA, "Queijo Mussarela");
  await criarProduto(orgA, userA, "Queijo Prato");
  await criarProduto(orgA, userA, "Pão de Queijo");
  await criarProduto(orgA, userA, "Salgadinho de Queijo", { sku: "SLG-1" });
  await criarProduto(orgA, userA, "Arroz Tipo 1", { barcode: "7890000000001" });
  await criarProduto(orgB, userA, "Queijo da outra rede");
});

afterAll(resetDb);

describe("products.searchPdv", () => {
  it("não devolve produto de outra organização", async () => {
    const result = await call(
      searchProductsForPdv,
      { search: "queijo", page: 1, pageSize: 20 },
      { context: s2sContext(userA, orgA) },
    );

    expect(nomes(result)).not.toContain("Queijo da outra rede");
    expect(result.totalCount).toBe(4);
  });

  it("põe quem começa com o termo antes de quem só o contém", async () => {
    const result = await call(
      searchProductsForPdv,
      { search: "queijo", page: 1, pageSize: 20 },
      { context: s2sContext(userA, orgA) },
    );

    expect(nomes(result)).toEqual([
      "Queijo Mussarela",
      "Queijo Prato",
      "Pão de Queijo",
      "Salgadinho de Queijo",
    ]);
  });

  it("pagina sem repetir nem pular na virada entre os dois baldes", async () => {
    const ctx = { context: s2sContext(userA, orgA) };
    // pageSize 3 força a página 1 a emendar os 2 do prefixo com 1 do resto.
    const p1 = await call(
      searchProductsForPdv,
      { search: "queijo", page: 1, pageSize: 3 },
      ctx,
    );
    const p2 = await call(
      searchProductsForPdv,
      { search: "queijo", page: 2, pageSize: 3 },
      ctx,
    );

    expect(nomes(p1)).toEqual([
      "Queijo Mussarela",
      "Queijo Prato",
      "Pão de Queijo",
    ]);
    expect(nomes(p2)).toEqual(["Salgadinho de Queijo"]);
    expect(p1.totalPages).toBe(2);
    expect(p1.totalCount).toBe(4);
  });

  it("a última página do prefixo não invade o balde seguinte", async () => {
    const ctx = { context: s2sContext(userA, orgA) };
    const p1 = await call(
      searchProductsForPdv,
      { search: "queijo", page: 1, pageSize: 2 },
      ctx,
    );
    const p2 = await call(
      searchProductsForPdv,
      { search: "queijo", page: 2, pageSize: 2 },
      ctx,
    );

    expect(nomes(p1)).toEqual(["Queijo Mussarela", "Queijo Prato"]);
    expect(nomes(p2)).toEqual(["Pão de Queijo", "Salgadinho de Queijo"]);
  });

  it("casa também por SKU e por código de barras", async () => {
    const ctx = { context: s2sContext(userA, orgA) };
    const porSku = await call(
      searchProductsForPdv,
      { search: "SLG-1", page: 1, pageSize: 10 },
      ctx,
    );
    const porCodigo = await call(
      searchProductsForPdv,
      { search: "7890000000001", page: 1, pageSize: 10 },
      ctx,
    );

    expect(nomes(porSku)).toEqual(["Salgadinho de Queijo"]);
    expect(nomes(porCodigo)).toEqual(["Arroz Tipo 1"]);
  });

  it("sem busca, lista tudo da organização em ordem alfabética", async () => {
    const result = await call(
      searchProductsForPdv,
      { page: 1, pageSize: 10 },
      { context: s2sContext(userA, orgA) },
    );

    expect(result.totalCount).toBe(5);
    expect(nomes(result)[0]).toBe("Arroz Tipo 1");
  });

  it("busca sem resultado devolve lista vazia, não a lista inteira", async () => {
    const result = await call(
      searchProductsForPdv,
      { search: "nao-existe-isso", page: 1, pageSize: 10 },
      { context: s2sContext(userA, orgA) },
    );

    expect(result.products).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(1);
  });
});
