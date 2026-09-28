import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateCatalogOrderStatus } from "@/app/router/catalog-order/update-status";
import type { Organization, User } from "@/generated/prisma/client";
import { SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

const PATH = ["catalogOrder", "updateStatus"] as const;

async function createPendingOrbitaSale(
  org: Organization,
  user: User,
  saleNumber: number,
) {
  const product = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: "Café",
      slug: `cafe-${Math.random().toString(36).slice(2)}`,
      salePrice: 10,
      createdById: user.id,
      trackStock: true,
      currentStock: 10,
    },
  });
  const sale = await prisma.sale.create({
    data: {
      organizationId: org.id,
      saleNumber,
      subtotal: 20,
      total: 20,
      status: SaleStatus.PENDING_APPROVAL,
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          quantity: 2,
          unitPrice: 10,
          total: 20,
        },
      },
    },
  });
  return { sale, product };
}

const pixPayment = {
  method: "PIX" as const,
  amount: 20,
  gatewayPaymentId: "pay_123",
  paidAt: "2026-09-26T12:00:00.000Z",
};

describe("catalogOrder.updateStatus", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let userB: User;

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Loja A");
    orgB = await createOrg("Loja B");
    userA = await createUser();
    userB = await createUser();
    await createMember(userA, orgA);
    await createMember(userB, orgB);
  });

  afterAll(resetDb);

  it("a chave da org B não confirma a venda da org A", async () => {
    const { sale, product } = await createPendingOrbitaSale(orgA, userA, 1);

    await expect(
      call(
        updateCatalogOrderStatus,
        { saleId: sale.id, status: "CONFIRMED", payment: pixPayment },
        { context: s2sContext(userB, orgB), path: [...PATH] },
      ),
    ).rejects.toThrow(/não encontrado/i);

    const untouched = await prisma.sale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect(untouched.status).toBe(SaleStatus.PENDING_APPROVAL);
    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(stock.currentStock)).toBe(10);
  });

  it("confirma com pagamento e baixa estoque uma única vez", async () => {
    const { sale, product } = await createPendingOrbitaSale(orgA, userA, 2);
    const options = {
      context: s2sContext(userA, orgA, ["sales:rw"]),
      path: [...PATH],
    };
    const input = {
      saleId: sale.id,
      status: "CONFIRMED" as const,
      payment: pixPayment,
    };

    const first = await call(updateCatalogOrderStatus, input, options);
    const second = await call(updateCatalogOrderStatus, input, options);

    expect(first).toEqual({ ok: true, status: SaleStatus.CONFIRMED });
    expect(second).toEqual({ ok: true, status: SaleStatus.CONFIRMED });

    const payments = await prisma.salePayment.findMany({
      where: { saleId: sale.id },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].method).toBe("PIX");
    expect(Number(payments[0].amount)).toBe(20);

    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(stock.currentStock)).toBe(8);
    const movements = await prisma.stockMovement.count({
      where: { saleId: sale.id },
    });
    expect(movements).toBe(1);
  });

  it("cancela sem mexer no estoque e é idempotente", async () => {
    const { sale, product } = await createPendingOrbitaSale(orgA, userA, 3);
    const options = { context: s2sContext(userA, orgA), path: [...PATH] };

    await call(
      updateCatalogOrderStatus,
      { saleId: sale.id, status: "CANCELED" },
      options,
    );
    const again = await call(
      updateCatalogOrderStatus,
      { saleId: sale.id, status: "CANCELED" },
      options,
    );

    expect(again).toEqual({ ok: true, status: SaleStatus.CANCELLED });
    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(stock.currentStock)).toBe(10);
  });

  it("chave sem o escopo sales:rw é barrada", async () => {
    const { sale } = await createPendingOrbitaSale(orgA, userA, 4);

    await expect(
      call(
        updateCatalogOrderStatus,
        { saleId: sale.id, status: "CONFIRMED", payment: pixPayment },
        { context: s2sContext(userA, orgA, ["pdv:read"]), path: [...PATH] },
      ),
    ).rejects.toThrow(/permissão/i);
  });
});
