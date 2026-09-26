import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listCatalogOrders } from "@/app/router/pedidos/catalog-orders/list";
import { rejectCatalogOrder } from "@/app/router/pedidos/catalog-orders/reject";
import { approvePending } from "@/app/router/sales/approve-pending";
import { listPendingApproval } from "@/app/router/sales/list-pending-approval";
import type { Organization, User } from "@/generated/prisma/client";
import { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * A aba "Catálogo online" do /pedidos: só pedidos de catálogo, só da org do
 * contexto — e o pedido do Órbita não pode ser fechado pelo balcão.
 */
describe("kitchen.catalogOrders", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let userB: User;
  let saleNumber = 0;
  const saleIds: Record<string, string> = {};

  async function createSale(
    org: Organization,
    user: User,
    key: string,
    origin: SaleOrigin,
    status: SaleStatus,
  ) {
    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Produto ${key}`,
        slug: `produto-${key}-${Math.random().toString(36).slice(2)}`,
        salePrice: 10,
        createdById: user.id,
      },
    });
    const sale = await prisma.sale.create({
      data: {
        organizationId: org.id,
        saleNumber: ++saleNumber,
        subtotal: 20,
        total: 20,
        status,
        origin,
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
    saleIds[key] = sale.id;
  }

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    userA = await createUser();
    userB = await createUser();
    await createMember(userA, orgA);
    await createMember(userB, orgB);

    await createSale(
      orgA,
      userA,
      "a-aprovacao",
      SaleOrigin.CATALOGO_APROVACAO,
      SaleStatus.PENDING_APPROVAL,
    );
    await createSale(
      orgA,
      userA,
      "a-orbita",
      SaleOrigin.CATALOGO_ORBITA,
      SaleStatus.PENDING_APPROVAL,
    );
    await createSale(
      orgA,
      userA,
      "a-cozinha",
      SaleOrigin.CATALOGO_COZINHA,
      SaleStatus.CONFIRMED,
    );
    await createSale(
      orgA,
      userA,
      "a-pdv",
      SaleOrigin.PDV,
      SaleStatus.COMPLETED,
    );
    await createSale(
      orgB,
      userB,
      "b-aprovacao",
      SaleOrigin.CATALOGO_APROVACAO,
      SaleStatus.PENDING_APPROVAL,
    );
  });

  afterAll(resetDb);

  it("devolve só pedidos de catálogo da organização do contexto", async () => {
    const result = await call(
      listCatalogOrders,
      { limit: 30 },
      { context: s2sContext(userA, orgA) },
    );

    const ids = result.orders.map((order) => order.id).sort();
    expect(ids).toEqual(
      [
        saleIds["a-aprovacao"],
        saleIds["a-orbita"],
        saleIds["a-cozinha"],
      ].sort(),
    );
    expect(ids).not.toContain(saleIds["a-pdv"]);
    expect(ids).not.toContain(saleIds["b-aprovacao"]);
  });

  it("não vaza pedido da outra org para a org B", async () => {
    const result = await call(
      listCatalogOrders,
      { limit: 30 },
      { context: s2sContext(userB, orgB) },
    );

    expect(result.orders.map((order) => order.id)).toEqual([
      saleIds["b-aprovacao"],
    ]);
  });

  it("filtra por grupo de status e pagina por cursor", async () => {
    const pending = await call(
      listCatalogOrders,
      { status: "PENDING", limit: 1 },
      { context: s2sContext(userA, orgA) },
    );
    expect(pending.orders).toHaveLength(1);
    expect(pending.nextCursor).not.toBeNull();

    const secondPage = await call(
      listCatalogOrders,
      { status: "PENDING", limit: 1, cursor: pending.nextCursor ?? undefined },
      { context: s2sContext(userA, orgA) },
    );
    expect(secondPage.orders).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect([pending.orders[0].id, secondPage.orders[0].id].sort()).toEqual(
      [saleIds["a-aprovacao"], saleIds["a-orbita"]].sort(),
    );
  });

  it("tira o pedido do Órbita da fila do PDV e recusa aprová-lo lá", async () => {
    const queue = await call(
      listPendingApproval,
      {},
      { context: s2sContext(userA, orgA) },
    );
    expect(queue.orders.map((order) => order.id)).toEqual([
      saleIds["a-aprovacao"],
    ]);

    await expect(
      call(
        approvePending,
        { saleId: saleIds["a-orbita"] },
        { context: s2sContext(userA, orgA) },
      ),
    ).rejects.toThrow("só o Órbita confirma ou cancela");
  });

  it("recusa com motivo só o pedido de aprovação da própria org", async () => {
    await expect(
      call(
        rejectCatalogOrder,
        { saleId: saleIds["a-orbita"], reason: "Tentativa indevida" },
        { context: s2sContext(userA, orgA) },
      ),
    ).rejects.toThrow("só o Órbita confirma ou cancela");

    await expect(
      call(
        rejectCatalogOrder,
        { saleId: saleIds["b-aprovacao"], reason: "Outra org" },
        { context: s2sContext(userA, orgA) },
      ),
    ).rejects.toThrow("Pedido não encontrado");

    await call(
      rejectCatalogOrder,
      { saleId: saleIds["a-aprovacao"], reason: "Sem estoque" },
      { context: s2sContext(userA, orgA) },
    );

    const cancelled = await call(
      listCatalogOrders,
      { status: "CANCELLED", limit: 30 },
      { context: s2sContext(userA, orgA) },
    );
    expect(cancelled.orders).toHaveLength(1);
    expect(cancelled.orders[0].closure).toEqual({
      kind: "REJECTED",
      reason: "Sem estoque",
    });
  });
});
