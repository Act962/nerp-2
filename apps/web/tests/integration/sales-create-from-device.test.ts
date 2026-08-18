import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSaleFromDevice } from "@/app/router/sales/create-from-device";
import type { Organization, Product, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, deviceContext, resetDb } from "./helpers";

async function makeProduct(org: Organization, user: User, stock: number) {
  return prisma.product.create({
    data: {
      organizationId: org.id,
      name: "Café",
      slug: `cafe-${Math.random().toString(36).slice(2)}`,
      salePrice: 10,
      createdById: user.id,
      trackStock: true,
      currentStock: stock,
    },
  });
}

function saleInput(product: Product, operationId: string) {
  return {
    operationId,
    discount: 0,
    total: 30,
    status: "COMPLETED" as const,
    payments: [{ method: "DINHEIRO" as const, amount: 30 }],
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity: 3,
        unitPrice: 10,
      },
    ],
  };
}

describe("sales.createFromDevice (Fase 3 — replay offline)", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let productA: Product;

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    userA = await createUser();
    await prisma.member.create({
      data: { organizationId: orgA.id, userId: userA.id, role: "owner" },
    });
    productA = await makeProduct(orgA, userA, 10);
  });

  afterAll(resetDb);

  it("cria a venda, atribui número do server e baixa o estoque", async () => {
    const result = await call(
      createSaleFromDevice,
      saleInput(productA, "op-1"),
      {
        context: deviceContext(userA, orgA),
      },
    );

    expect(result.duplicate).toBe(false);
    expect(result.saleNumber).toBeGreaterThan(0);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    expect(Number(product.currentStock)).toBe(7); // 10 - 3
  });

  it("é idempotente: replay do mesmo operationId não duplica nem baixa de novo", async () => {
    const replay = await call(
      createSaleFromDevice,
      saleInput(productA, "op-1"),
      {
        context: deviceContext(userA, orgA),
      },
    );
    expect(replay.duplicate).toBe(true);

    const sales = await prisma.sale.findMany({
      where: { clientOperationId: "op-1" },
    });
    expect(sales).toHaveLength(1);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    expect(Number(product.currentStock)).toBe(7); // não baixou de novo
  });

  it("não deixa vender produto de outra organização", async () => {
    const productB = await makeProduct(orgB, userA, 10);
    await expect(
      call(createSaleFromDevice, saleInput(productB, "op-2"), {
        context: deviceContext(userA, orgA),
      }),
    ).rejects.toThrow();
  });
});
