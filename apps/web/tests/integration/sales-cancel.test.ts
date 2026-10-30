import { call } from "@orpc/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Member,
  Organization,
  Product,
  User,
} from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, resetDb, s2sContext } from "./helpers";

/**
 * Cancelamento de venda concluída (specs/vendas-cancelamento.md), de ponta a
 * ponta: a venda nasce pela procedure real do PDV (estoque, caixa e
 * financeiro), é cancelada por `sales.cancel`, e tudo tem de voltar ao lugar.
 * A NFC-e usa o provedor simulado, como nos testes fiscais.
 */
vi.hoisted(() => {
  process.env.FISCAL_PROVEDOR_SIMULADO = "1";
});

const fila = vi.hoisted(() => ({ send: vi.fn(async () => ({ ids: [] })) }));
vi.mock("@/lib/inngest/client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/inngest/client")>();
  return { ...original, inngest: { ...original.inngest, send: fila.send } };
});

const { createSale } = await import("@/app/router/sales/create");
const { cancelSale } = await import("@/app/router/sales/cancel");
const { getSale } = await import("@/app/router/sales/get");
const { fiscalRoutes } = await import("@/app/router/fiscal");

const MOTIVO = "Cliente desistiu da compra no caixa";

describe("cancelamento de venda", () => {
  let orgA: Organization;
  let orgB: Organization;
  let dono: User;
  let caixa: User;
  let donoB: User;
  let membroDono: Member;
  let membroCaixa: Member;
  let produto: Product;
  let registerId: string;
  let seq = 0;

  const ctx = (user: User, org: Organization) => ({
    context: s2sContext(user, org),
  });

  async function abrirCaixa(member: Member, user: User) {
    return prisma.cashSession.create({
      data: {
        organizationId: orgA.id,
        memberId: member.id,
        registerId,
        openedById: user.id,
        openingBalance: 100,
        status: "OPEN",
      },
    });
  }

  async function vender(quantidade = 2) {
    return call(
      createSale,
      {
        subtotal: 30 * quantidade,
        discount: 0,
        total: 30 * quantidade,
        status: "COMPLETED" as const,
        // R$ 30 em dinheiro e o resto no PIX — exercita gaveta e não-gaveta.
        payments: [
          { method: "DINHEIRO" as const, amount: 30 },
          ...(quantidade > 1
            ? [{ method: "PIX" as const, amount: 30 * quantidade - 30 }]
            : []),
        ],
        items: [
          {
            productId: produto.id,
            productName: produto.name,
            quantity: quantidade,
            unitPrice: 30,
          },
        ],
      },
      ctx(dono, orgA),
    );
  }

  async function estoque() {
    const p = await prisma.product.findUniqueOrThrow({
      where: { id: produto.id },
      select: { currentStock: true },
    });
    return Number(p.currentStock);
  }

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Mercadinho A");
    orgB = await createOrg("Mercadinho B");
    dono = await createUser();
    caixa = await createUser();
    donoB = await createUser();
    membroDono = await prisma.member.create({
      data: { organizationId: orgA.id, userId: dono.id, role: "owner" },
    });
    membroCaixa = await prisma.member.create({
      data: { organizationId: orgA.id, userId: caixa.id, role: "member" },
    });
    await prisma.member.create({
      data: { organizationId: orgB.id, userId: donoB.id, role: "owner" },
    });
    const register = await prisma.cashRegister.create({
      data: { organizationId: orgA.id, name: "Caixa 01" },
    });
    registerId = register.id;
    await prisma.fiscalConfig.create({
      data: {
        organizationId: orgA.id,
        taxRegime: "SIMPLES_NACIONAL",
        // CNPJ próprio: o provedor simulado é um só no processo.
        cnpj: "11444777000161",
        ie: "194567890",
        legalName: "MERCADINHO A LTDA",
        cityCode: "2211001",
        cityName: "Teresina",
        address: "Av. Frei Serafim",
        addressNumber: "1000",
        neighborhood: "Centro",
        zipCode: "64001020",
        defaultCfop: "5102",
        defaultCstIcms: "102",
        defaultCstPis: "49",
        defaultCstCofins: "49",
      },
    });
  });

  beforeEach(async () => {
    seq += 1;
    const org = { organizationId: orgA.id };
    await prisma.fiscalDocument.deleteMany({ where: org });
    await prisma.paymentEntry.deleteMany({ where: org });
    await prisma.cashMovement.deleteMany({ where: org });
    await prisma.cashSession.deleteMany({ where: org });
    await prisma.stockMovement.deleteMany({ where: org });
    await prisma.sale.deleteMany({ where: org });
    await prisma.product.deleteMany({ where: org });
    // Série nova a cada teste: o simulado lembra dos números já usados.
    await prisma.fiscalSeries.deleteMany({ where: org });
    await prisma.fiscalConfig.update({
      where: { organizationId: orgA.id },
      data: { nfceNextNumber: seq * 100 },
    });
    produto = await prisma.product.create({
      data: {
        organizationId: orgA.id,
        name: "Arroz 5kg",
        slug: `arroz-${seq}-${Date.now()}`,
        salePrice: 30,
        costPrice: 20,
        createdById: dono.id,
        trackStock: true,
        currentStock: 50,
        ncm: "10063021",
      },
    });
  });

  it("devolve o estoque, estorna o caixa e tira a venda do financeiro", async () => {
    const sessao = await abrirCaixa(membroDono, dono);
    const venda = await vender(2);
    expect(await estoque()).toBe(48);

    const r = await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(dono, orgA),
    );
    expect(r).toMatchObject({
      saleNumber: venda.saleNumber,
      notaCancelada: null,
      caixa: "SESSAO_DA_VENDA",
      devolverDinheiroManualmente: false,
    });

    expect(await estoque()).toBe(50);
    const devolucoes = await prisma.stockMovement.findMany({
      where: { saleId: venda.id, type: "DEVOLUCAO" },
      select: { quantity: true, previousStock: true, newStock: true },
    });
    expect(
      devolucoes.map((d) => [
        Number(d.quantity),
        Number(d.previousStock),
        Number(d.newStock),
      ]),
    ).toEqual([[2, 48, 50]]);

    const estornos = await prisma.cashMovement.findMany({
      where: { saleId: venda.id, type: "ESTORNO", sessionId: sessao.id },
      select: { amount: true, paymentMethod: true },
    });
    expect(
      estornos.map((e) => [e.paymentMethod, Number(e.amount)]).sort(),
    ).toEqual([
      ["DINHEIRO", 30],
      ["PIX", 30],
    ]);

    const lancamentos = await prisma.paymentEntry.findMany({
      where: { saleId: venda.id },
      select: { status: true },
    });
    expect(lancamentos.length).toBeGreaterThan(0);
    expect(lancamentos.every((l) => l.status === "CANCELLED")).toBe(true);

    const detalhe = await call(getSale, { saleId: venda.id }, ctx(dono, orgA));
    expect(detalhe).toMatchObject({
      status: "CANCELLED",
      cancellationReason: MOTIVO,
    });
  });

  it("o resumo do caixa volta ao fundo de abertura", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(2);
    await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(dono, orgA),
    );
    const { summarizeSession } = await import("@/app/router/caixa/_access");
    const movimentos = await prisma.cashMovement.findMany({
      where: { organizationId: orgA.id },
      select: { type: true, amount: true, paymentMethod: true },
    });
    const resumo = summarizeSession(
      100,
      movimentos.map((m) => ({ ...m, amount: Number(m.amount) })),
    );
    expect(resumo).toMatchObject({ salesTotal: 0, expectedCash: 100 });
  });

  it("cancela a NFC-e autorizada junto, na SEFAZ", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    const nota = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(dono, orgA),
    );
    expect(nota.status).toBe("AUTHORIZED");

    const r = await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(dono, orgA),
    );
    expect(r.notaCancelada).toEqual({ numero: nota.numero, serie: nota.serie });
    expect(
      await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: nota.id } }),
    ).toMatchObject({ status: "CANCELLED", cancelReason: MOTIVO });

    // Venda cancelada não emite outra nota.
    await expect(
      call(fiscalRoutes.emitirNfce, { saleId: venda.id }, ctx(dono, orgA)),
    ).rejects.toThrow(/Venda cancelada/);
  });

  it("nota fora do prazo de 30 min barra o cancelamento e nada é estornado", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(2);
    const nota = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(dono, orgA),
    );
    await prisma.fiscalDocument.update({
      where: { id: nota.id },
      data: { authorizedAt: new Date(Date.now() - 31 * 60_000) },
    });

    await expect(
      call(
        cancelSale,
        { saleId: venda.id, justificativa: MOTIVO },
        ctx(dono, orgA),
      ),
    ).rejects.toThrow(/prazo para cancelar/);
    expect(
      await prisma.sale.findUniqueOrThrow({ where: { id: venda.id } }),
    ).toMatchObject({ status: "COMPLETED", cancelledAt: null });
    expect(await estoque()).toBe(48);
    expect(
      await prisma.cashMovement.count({ where: { type: "ESTORNO" } }),
    ).toBe(0);
  });

  it("nota ainda em transmissão barra o cancelamento", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    const nota = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(dono, orgA),
    );
    await prisma.fiscalDocument.update({
      where: { id: nota.id },
      data: { status: "PROCESSING" },
    });
    await expect(
      call(
        cancelSale,
        { saleId: venda.id, justificativa: MOTIVO },
        ctx(dono, orgA),
      ),
    ).rejects.toThrow(/sendo transmitida/);
  });

  it("cancelar duas vezes não devolve o estoque duas vezes", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(2);
    await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(dono, orgA),
    );
    await expect(
      call(
        cancelSale,
        { saleId: venda.id, justificativa: MOTIVO },
        ctx(dono, orgA),
      ),
    ).rejects.toThrow(/já está cancelada/);
    expect(await estoque()).toBe(50);
  });

  it("caixa da venda fechado: estorna na sessão aberta de quem cancela", async () => {
    const daVenda = await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    await prisma.cashSession.update({
      where: { id: daVenda.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    const atual = await abrirCaixa(membroDono, dono);

    const r = await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(dono, orgA),
    );
    expect(r.caixa).toBe("SESSAO_ATUAL");
    expect(
      await prisma.cashMovement.count({
        where: { sessionId: daVenda.id, type: "ESTORNO" },
      }),
    ).toBe(0);
    expect(
      await prisma.cashMovement.count({
        where: { sessionId: atual.id, type: "ESTORNO" },
      }),
    ).toBeGreaterThan(0);
  });

  it("sem caixa aberto: não mexe em sessão fechada e avisa para devolver o dinheiro à mão", async () => {
    const daVenda = await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    await prisma.cashSession.update({
      where: { id: daVenda.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    const r = await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(dono, orgA),
    );
    expect(r).toMatchObject({
      caixa: "SEM_CAIXA",
      devolverDinheiroManualmente: true,
    });
    expect(
      await prisma.cashMovement.count({ where: { type: "ESTORNO" } }),
    ).toBe(0);
    expect(await estoque()).toBe(50);
  });

  it("caixa sem permissão não cancela; a permissão dedicada libera", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    await expect(
      call(
        cancelSale,
        { saleId: venda.id, justificativa: MOTIVO },
        ctx(caixa, orgA),
      ),
    ).rejects.toThrow(/permissão/);

    await prisma.member.update({
      where: { id: membroCaixa.id },
      data: { permissions: ["autorizar-cancelamento"] },
    });
    const r = await call(
      cancelSale,
      { saleId: venda.id, justificativa: MOTIVO },
      ctx(caixa, orgA),
    );
    expect(r.saleNumber).toBe(venda.saleNumber);
    await prisma.member.update({
      where: { id: membroCaixa.id },
      data: { permissions: [] },
    });
  });

  it("justificativa curta é recusada", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    await expect(
      call(
        cancelSale,
        { saleId: venda.id, justificativa: "desistiu" },
        ctx(dono, orgA),
      ),
    ).rejects.toThrow(/15/);
  });

  it("outra empresa não cancela nem abre a venda", async () => {
    await abrirCaixa(membroDono, dono);
    const venda = await vender(1);
    await expect(
      call(
        cancelSale,
        { saleId: venda.id, justificativa: MOTIVO },
        ctx(donoB, orgB),
      ),
    ).rejects.toThrow(/Venda não encontrada/);
    await expect(
      call(getSale, { saleId: venda.id }, ctx(donoB, orgB)),
    ).rejects.toThrow(/Venda não encontrada/);
    expect(
      await prisma.sale.findUniqueOrThrow({ where: { id: venda.id } }),
    ).toMatchObject({ status: "COMPLETED" });
  });
});
