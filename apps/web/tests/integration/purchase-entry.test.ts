import { call } from "@orpc/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cancelPurchase } from "@/app/router/purchase/cancel";
import { createPurchase } from "@/app/router/purchase/create";
import { getPurchase } from "@/app/router/purchase/get";
import { listPurchases } from "@/app/router/purchase/list";
import { processPurchase } from "@/app/router/purchase/process";
import { updatePurchase } from "@/app/router/purchase/update";
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
 * A entrada de nota é a única procedure do sistema que, numa transação só,
 * mexe em estoque, custo, preço de venda e dívida. O que estes testes protegem
 * é justamente o que dói caro se escapar: processar duas vezes, vazar para
 * outro inquilino e duplicar contas a pagar.
 */

let orgA: Organization;
let orgB: Organization;
let userA: User;
let userB: User;

let seq = 0;

async function criarProduto(
  org: Organization,
  dono: User,
  overrides: {
    name?: string;
    costPrice?: number;
    salePrice?: number;
    currentStock?: number;
    trackStock?: boolean;
  } = {},
) {
  seq += 1;
  const name = overrides.name ?? `Produto ${seq}`;
  return prisma.product.create({
    data: {
      organizationId: org.id,
      name,
      slug: `produto-${seq}-${Date.now()}`,
      costPrice: overrides.costPrice ?? 5,
      salePrice: overrides.salePrice ?? 10,
      currentStock: overrides.currentStock ?? 10,
      trackStock: overrides.trackStock ?? true,
      createdById: dono.id,
    },
    select: { id: true },
  });
}

interface ItemArg {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  newSalePrice?: number | null;
}

async function criarNota(
  org: Organization,
  user: User,
  items: ItemArg[],
  header: { installments?: number; invoiceNumber?: string } = {},
) {
  return call(
    createPurchase,
    {
      supplierId: null,
      invoiceNumber: header.invoiceNumber ?? "1001",
      orderDate: null,
      shipping: 0,
      discount: 0,
      installments: header.installments ?? 1,
      firstDueDate: null,
      notes: null,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
        newSalePrice: item.newSalePrice ?? null,
      })),
    },
    { context: s2sContext(user, org) },
  );
}

beforeEach(async () => {
  await resetDb();
  orgA = await createOrg("Rede A");
  orgB = await createOrg("Rede B");
  userA = await createUser();
  userB = await createUser();
  await createMember(userA, orgA);
  await createMember(userB, orgB);
});

afterAll(resetDb);

describe("purchase — escopo por organização", () => {
  it("a lista só devolve as entradas da organização do contexto", async () => {
    const produtoA = await criarProduto(orgA, userA);
    const produtoB = await criarProduto(orgB, userB);
    await criarNota(orgA, userA, [
      { productId: produtoA.id, quantity: 1, unitPrice: 10 },
    ]);
    await criarNota(orgB, userB, [
      { productId: produtoB.id, quantity: 1, unitPrice: 10 },
    ]);

    const result = await call(
      listPurchases,
      { page: 1, pageSize: 10 },
      { context: s2sContext(userA, orgA) },
    );

    expect(result.totalCount).toBe(1);
    expect(result.purchases[0].purchaseNumber).toBe(1);
  });

  it("não abre a entrada de outra organização", async () => {
    const produtoB = await criarProduto(orgB, userB);
    const notaB = await criarNota(orgB, userB, [
      { productId: produtoB.id, quantity: 1, unitPrice: 10 },
    ]);

    await expect(
      call(getPurchase, { id: notaB.id }, { context: s2sContext(userA, orgA) }),
    ).rejects.toThrow();
  });

  it("não processa a entrada de outra organização, e o estoque dela fica intacto", async () => {
    const produtoB = await criarProduto(orgB, userB, { currentStock: 10 });
    const notaB = await criarNota(orgB, userB, [
      { productId: produtoB.id, quantity: 5, unitPrice: 7 },
    ]);

    await expect(
      call(
        processPurchase,
        { id: notaB.id },
        { context: s2sContext(userA, orgA) },
      ),
    ).rejects.toThrow();

    const produto = await prisma.product.findUniqueOrThrow({
      where: { id: produtoB.id },
      select: { currentStock: true },
    });
    expect(produto.currentStock.toNumber()).toBe(10);

    const nota = await prisma.purchase.findUniqueOrThrow({
      where: { id: notaB.id },
      select: { status: true },
    });
    expect(nota.status).toBe("PENDING");
  });
});

describe("purchase.process — estoque e custo", () => {
  it("move o estoque, grava o movimento de COMPRA e reescreve o custo", async () => {
    const produto = await criarProduto(orgA, userA, {
      currentStock: 10,
      costPrice: 5,
    });
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 20, unitPrice: 7 },
    ]);

    const resultado = await call(
      processPurchase,
      { id: nota.id },
      { context: s2sContext(userA, orgA) },
    );

    expect(resultado.itemsMoved).toBe(1);
    expect(resultado.costsUpdated).toBe(1);

    const atualizado = await prisma.product.findUniqueOrThrow({
      where: { id: produto.id },
      select: { currentStock: true, costPrice: true },
    });
    expect(atualizado.currentStock.toNumber()).toBe(30);
    expect(atualizado.costPrice.toNumber()).toBe(7);

    const movimento = await prisma.stockMovement.findFirstOrThrow({
      where: { purchaseId: nota.id },
    });
    expect(movimento.type).toBe("COMPRA");
    expect(movimento.quantity.toNumber()).toBe(20);
    expect(movimento.previousStock.toNumber()).toBe(10);
    expect(movimento.newStock.toNumber()).toBe(30);
    expect(movimento.unitCost?.toNumber()).toBe(7);

    const gravada = await prisma.purchase.findUniqueOrThrow({
      where: { id: nota.id },
      select: { status: true, receivedDate: true },
    });
    expect(gravada.status).toBe("RECEIVED");
    expect(gravada.receivedDate).not.toBeNull();
  });

  it("o desconto da linha entra no custo unitário", async () => {
    const produto = await criarProduto(orgA, userA, { currentStock: 0 });
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 10, unitPrice: 7.5, discount: 5 },
    ]);

    await call(
      processPurchase,
      { id: nota.id },
      { context: s2sContext(userA, orgA) },
    );

    const atualizado = await prisma.product.findUniqueOrThrow({
      where: { id: produto.id },
      select: { costPrice: true },
    });
    expect(atualizado.costPrice.toNumber()).toBe(7);
  });

  it("bonificação com valor zero não zera o custo do produto", async () => {
    const produto = await criarProduto(orgA, userA, {
      currentStock: 0,
      costPrice: 9.9,
    });
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 12, unitPrice: 0 },
    ]);

    const resultado = await call(
      processPurchase,
      { id: nota.id },
      { context: s2sContext(userA, orgA) },
    );

    expect(resultado.costsUpdated).toBe(0);
    const atualizado = await prisma.product.findUniqueOrThrow({
      where: { id: produto.id },
      select: { costPrice: true, currentStock: true },
    });
    // O estoque entra — a mercadoria chegou. O custo é que não se mexe.
    expect(atualizado.currentStock.toNumber()).toBe(12);
    expect(atualizado.costPrice.toNumber()).toBe(9.9);
  });

  it("produto sem controle de estoque tem custo atualizado, mas nenhum movimento", async () => {
    const produto = await criarProduto(orgA, userA, {
      trackStock: false,
      currentStock: 0,
      costPrice: 3,
    });
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 4, unitPrice: 8 },
    ]);

    const resultado = await call(
      processPurchase,
      { id: nota.id },
      { context: s2sContext(userA, orgA) },
    );

    expect(resultado.itemsMoved).toBe(0);
    expect(resultado.costsUpdated).toBe(1);

    const atualizado = await prisma.product.findUniqueOrThrow({
      where: { id: produto.id },
      select: { costPrice: true, currentStock: true },
    });
    expect(atualizado.costPrice.toNumber()).toBe(8);
    expect(atualizado.currentStock.toNumber()).toBe(0);
    expect(
      await prisma.stockMovement.count({ where: { purchaseId: nota.id } }),
    ).toBe(0);
  });

  it("aplica o preço de venda só nas linhas em que o operador aceitou", async () => {
    const comPreco = await criarProduto(orgA, userA, { salePrice: 10 });
    const semPreco = await criarProduto(orgA, userA, { salePrice: 20 });
    const nota = await criarNota(orgA, userA, [
      {
        productId: comPreco.id,
        quantity: 1,
        unitPrice: 6,
        newSalePrice: 13.5,
      },
      { productId: semPreco.id, quantity: 1, unitPrice: 6, newSalePrice: null },
    ]);

    const resultado = await call(
      processPurchase,
      { id: nota.id },
      { context: s2sContext(userA, orgA) },
    );

    expect(resultado.pricesUpdated).toBe(1);
    const [a, b] = await Promise.all([
      prisma.product.findUniqueOrThrow({
        where: { id: comPreco.id },
        select: { salePrice: true },
      }),
      prisma.product.findUniqueOrThrow({
        where: { id: semPreco.id },
        select: { salePrice: true },
      }),
    ]);
    expect(a.salePrice.toNumber()).toBe(13.5);
    expect(b.salePrice.toNumber()).toBe(20);
  });
});

describe("purchase.process — reprocessamento", () => {
  it("processar duas vezes falha e não dobra estoque nem movimento", async () => {
    const produto = await criarProduto(orgA, userA, { currentStock: 10 });
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 20, unitPrice: 7 },
    ]);
    const ctx = { context: s2sContext(userA, orgA) };

    await call(processPurchase, { id: nota.id }, ctx);
    await expect(call(processPurchase, { id: nota.id }, ctx)).rejects.toThrow();

    const atualizado = await prisma.product.findUniqueOrThrow({
      where: { id: produto.id },
      select: { currentStock: true },
    });
    expect(atualizado.currentStock.toNumber()).toBe(30);
    expect(
      await prisma.stockMovement.count({ where: { purchaseId: nota.id } }),
    ).toBe(1);
  });

  it("nota já processada não pode ser editada nem cancelada", async () => {
    const produto = await criarProduto(orgA, userA);
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 1, unitPrice: 5 },
    ]);
    const ctx = { context: s2sContext(userA, orgA) };
    await call(processPurchase, { id: nota.id }, ctx);

    await expect(
      call(
        updatePurchase,
        {
          id: nota.id,
          supplierId: null,
          invoiceNumber: "outra",
          orderDate: null,
          shipping: 0,
          discount: 0,
          installments: 1,
          firstDueDate: null,
          notes: null,
          items: [],
        },
        ctx,
      ),
    ).rejects.toThrow();

    await expect(call(cancelPurchase, { id: nota.id }, ctx)).rejects.toThrow();
  });
});

describe("purchase.process — contas a pagar", () => {
  it("gera as parcelas fechando o total exato, sem duplicar no reprocessamento", async () => {
    const produto = await criarProduto(orgA, userA, { currentStock: 0 });
    const nota = await criarNota(
      orgA,
      userA,
      [{ productId: produto.id, quantity: 1, unitPrice: 100 }],
      { installments: 3, invoiceNumber: "45678" },
    );
    const ctx = { context: s2sContext(userA, orgA) };

    const resultado = await call(processPurchase, { id: nota.id }, ctx);
    expect(resultado.payableEntries).toBe(3);

    await expect(call(processPurchase, { id: nota.id }, ctx)).rejects.toThrow();

    const parcelas = await prisma.paymentEntry.findMany({
      where: { purchaseId: nota.id },
      orderBy: { purchaseEntryKey: "asc" },
      select: {
        amount: true,
        type: true,
        status: true,
        documentNumber: true,
        installmentTotal: true,
        installmentCurrent: true,
      },
    });

    expect(parcelas).toHaveLength(3);
    expect(parcelas.map((parcela) => parcela.amount)).toEqual([
      3333, 3333, 3334,
    ]);
    expect(parcelas.reduce((soma, p) => soma + p.amount, 0)).toBe(10_000);
    expect(parcelas.every((p) => p.type === "PAYABLE")).toBe(true);
    // Nunca nasce paga: a mercadoria chegou, o dinheiro não saiu.
    expect(parcelas.every((p) => p.status === "PENDING")).toBe(true);
    expect(parcelas.every((p) => p.documentNumber === "45678")).toBe(true);
    expect(parcelas[1].installmentCurrent).toBe(2);
    expect(parcelas[1].installmentTotal).toBe(3);
  });

  it("a categoria da compra nasce fora do resultado, para não dobrar com o CMV", async () => {
    const produto = await criarProduto(orgA, userA, { currentStock: 0 });
    const nota = await criarNota(orgA, userA, [
      { productId: produto.id, quantity: 1, unitPrice: 50 },
    ]);

    await call(
      processPurchase,
      { id: nota.id },
      { context: s2sContext(userA, orgA) },
    );

    const lancamento = await prisma.paymentEntry.findFirstOrThrow({
      where: { purchaseId: nota.id },
      select: { category: { select: { excludeFromResult: true } } },
    });
    expect(lancamento.category?.excludeFromResult).toBe(true);
  });
});
