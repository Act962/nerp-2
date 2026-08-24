import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeCaixaFromDevice } from "@/app/router/caixa/close-from-device";
import { cashMovementFromDevice } from "@/app/router/caixa/movement-from-device";
import { openCaixaFromDevice } from "@/app/router/caixa/open-from-device";
import { createSaleFromDevice } from "@/app/router/sales/create-from-device";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, deviceOptions, resetDb } from "./helpers";

describe("caixa por device (Corte 1 — sessão de caixa offline)", () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let userB: User;
  let productId: string;
  const asA = (...path: string[]) => deviceOptions(userA, orgA, path);

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    userA = await createUser();
    userB = await createUser();
    await prisma.member.create({
      data: { organizationId: orgA.id, userId: userA.id, role: "owner" },
    });
    await prisma.member.create({
      data: { organizationId: orgB.id, userId: userB.id, role: "owner" },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: orgA.id,
        name: "Café",
        slug: `cafe-${Math.random().toString(36).slice(2)}`,
        salePrice: 10,
        createdById: userA.id,
        trackStock: true,
        currentStock: 100,
      },
    });
    productId = product.id;
  });

  afterAll(resetDb);

  it("abre → vende (misto) → sangria → fecha; só DINHEIRO afeta a gaveta", async () => {
    const open = await call(
      openCaixaFromDevice,
      { operationId: "s1", openingBalance: 100, registerName: "Caixa 01" },
      asA("caixa", "openFromDevice"),
    );
    expect(open.duplicate).toBe(false);

    // Venda mista R$100 = R$40 dinheiro + R$60 crédito.
    const sale = await call(
      createSaleFromDevice,
      {
        operationId: "sale-1",
        clientSessionId: "s1",
        discount: 0,
        total: 100,
        status: "COMPLETED" as const,
        payments: [
          { method: "DINHEIRO" as const, amount: 40 },
          { method: "CREDITO" as const, amount: 60 },
        ],
        items: [
          { productId, productName: "Café", quantity: 10, unitPrice: 10 },
        ],
      },
      asA("sales", "createFromDevice"),
    );
    expect(sale.duplicate).toBe(false);

    // A venda amarra a sessão.
    const saleRow = await prisma.sale.findUniqueOrThrow({
      where: { id: sale.saleId },
      select: { cashSessionId: true },
    });
    expect(saleRow.cashSessionId).toBe(open.sessionId);

    // Sangria R$30.
    const sangria = await call(
      cashMovementFromDevice,
      { operationId: "m1", clientSessionId: "s1", kind: "SANGRIA", amount: 30 },
      asA("caixa", "movementFromDevice"),
    );
    expect(sangria.duplicate).toBe(false);

    // Esperado na gaveta = 100 (abertura) + 40 (venda em dinheiro) − 30 (sangria)
    // = 110. O crédito de R$60 NÃO entra na gaveta.
    const close = await call(
      closeCaixaFromDevice,
      { operationId: "c1", clientSessionId: "s1", countedBalance: 110 },
      asA("caixa", "closeFromDevice"),
    );
    expect(close.expectedBalance).toBe(110);
    expect(close.difference).toBe(0);
    expect(close.duplicate).toBe(false);

    // Movimentos: ABERTURA, 2×VENDA, SANGRIA, FECHAMENTO.
    const movements = await prisma.cashMovement.findMany({
      where: { sessionId: open.sessionId },
      select: { type: true },
    });
    const byType: Record<string, number> = {};
    for (const m of movements) byType[m.type] = (byType[m.type] ?? 0) + 1;
    expect(byType.ABERTURA).toBe(1);
    expect(byType.VENDA).toBe(2);
    expect(byType.SANGRIA).toBe(1);
    expect(byType.FECHAMENTO).toBe(1);
  });

  it("é idempotente: replay de abrir/sangria/fechar não duplica", async () => {
    const reopen = await call(
      openCaixaFromDevice,
      { operationId: "s1", openingBalance: 100, registerName: "Caixa 01" },
      asA("caixa", "openFromDevice"),
    );
    expect(reopen.duplicate).toBe(true);
    expect(
      await prisma.cashSession.count({ where: { clientSessionId: "s1" } }),
    ).toBe(1);

    const resangria = await call(
      cashMovementFromDevice,
      { operationId: "m1", clientSessionId: "s1", kind: "SANGRIA", amount: 30 },
      asA("caixa", "movementFromDevice"),
    );
    expect(resangria.duplicate).toBe(true);
    expect(
      await prisma.cashMovement.count({ where: { clientOperationId: "m1" } }),
    ).toBe(1);

    // Fechamento já feito (sessão CLOSED) → devolve o mesmo esperado, ignora o
    // countedBalance do replay.
    const reclose = await call(
      closeCaixaFromDevice,
      { operationId: "c1", clientSessionId: "s1", countedBalance: 999 },
      asA("caixa", "closeFromDevice"),
    );
    expect(reclose.duplicate).toBe(true);
    expect(reclose.expectedBalance).toBe(110);
  });

  it("cross-tenant: outra org não mexe na sessão da orgA", async () => {
    await expect(
      call(
        cashMovementFromDevice,
        {
          operationId: "m-x",
          clientSessionId: "s1",
          kind: "SANGRIA",
          amount: 10,
        },
        deviceOptions(userB, orgB, ["caixa", "movementFromDevice"]),
      ),
    ).rejects.toThrow();
  });
});
