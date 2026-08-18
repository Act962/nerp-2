import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pullProducts } from "@/app/router/products/pull";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, deviceContext, resetDb } from "./helpers";

describe("products.pull (Fase 2 — sync incremental)", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    userA = await createUser();

    await prisma.product.createMany({
      data: [
        {
          organizationId: orgA.id,
          name: "Produto A1",
          slug: "a1",
          salePrice: 1,
          createdById: userA.id,
        },
        {
          organizationId: orgA.id,
          name: "Produto A2",
          slug: "a2",
          salePrice: 2,
          createdById: userA.id,
        },
        {
          organizationId: orgB.id,
          name: "Produto B1",
          slug: "b1",
          salePrice: 9,
          createdById: userA.id,
        },
      ],
    });
  });

  afterAll(resetDb);

  it("primeira sync (cursor null) traz só os produtos da org do device", async () => {
    const result = await call(
      pullProducts,
      { updatedAt: null, id: null, limit: 500 },
      { context: deviceContext(userA, orgA) },
    );
    const names = result.products.map((p) => p.name).sort();
    expect(names).toEqual(["Produto A1", "Produto A2"]);
    expect(result.cursor).not.toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it("pagina por keyset e não repete linhas", async () => {
    const first = await call(
      pullProducts,
      { updatedAt: null, id: null, limit: 1 },
      { context: deviceContext(userA, orgA) },
    );
    expect(first.products).toHaveLength(1);
    expect(first.hasMore).toBe(true);

    const second = await call(
      pullProducts,
      {
        updatedAt: first.cursor?.updatedAt ?? null,
        id: first.cursor?.id ?? null,
        limit: 1,
      },
      { context: deviceContext(userA, orgA) },
    );
    expect(second.products).toHaveLength(1);
    expect(second.products[0].id).not.toBe(first.products[0].id);
  });

  it("sync incremental: a partir do watermark, só o que mudou depois", async () => {
    const full = await call(
      pullProducts,
      { updatedAt: null, id: null, limit: 500 },
      { context: deviceContext(userA, orgA) },
    );
    // Nada mudou desde o watermark → vazio.
    const empty = await call(
      pullProducts,
      {
        updatedAt: full.cursor?.updatedAt ?? null,
        id: full.cursor?.id ?? null,
        limit: 500,
      },
      { context: deviceContext(userA, orgA) },
    );
    expect(empty.products).toHaveLength(0);

    // Mexe num produto de A → sobe o updatedAt → aparece na próxima incremental.
    const a1 = await prisma.product.findFirstOrThrow({
      where: { organizationId: orgA.id, name: "Produto A1" },
    });
    await prisma.product.update({
      where: { id: a1.id },
      data: { name: "Produto A1 (novo preço)" },
    });

    const incremental = await call(
      pullProducts,
      {
        updatedAt: full.cursor?.updatedAt ?? null,
        id: full.cursor?.id ?? null,
        limit: 500,
      },
      { context: deviceContext(userA, orgA) },
    );
    expect(incremental.products.map((p) => p.name)).toEqual([
      "Produto A1 (novo preço)",
    ]);
  });
});
