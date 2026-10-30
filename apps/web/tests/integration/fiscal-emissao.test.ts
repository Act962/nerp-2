import { call } from "@orpc/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, resetDb, s2sContext } from "./helpers";

/**
 * Fase 2 do fiscal (specs/fiscal-nfce.md) de ponta a ponta: procedure →
 * casos de uso → Prisma (documento, numeração atômica, montagem da nota) →
 * provedor. O provedor é o simulado — o mesmo que passa no contrato de
 * `ProvedorFiscal` —, então nada sai para a Focus nem para a SEFAZ.
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

const { fiscalRoutes } = await import("@/app/router/fiscal");

describe("emissão de NFC-e", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ownerA: User;
  let ownerB: User;
  let seq = 0;

  const ctx = (user: User, org: Organization) => ({
    context: s2sContext(user, org),
  });

  async function configurar(org: Organization, extra = {}) {
    await prisma.fiscalConfig.create({
      data: {
        organizationId: org.id,
        taxRegime: "SIMPLES_NACIONAL",
        cnpj: "11222333000181",
        ie: "194567890",
        legalName: "MERCADINHO EXEMPLO LTDA",
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
        ...extra,
      },
    });
  }

  async function vender(
    org: Organization,
    dono: User,
    produto = { ncm: "10063021" as string | null },
  ) {
    seq += 1;
    const p = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Arroz ${seq}`,
        slug: `arroz-${seq}-${Date.now()}`,
        costPrice: 10,
        salePrice: 25,
        createdById: dono.id,
        ncm: produto.ncm,
      },
    });
    return prisma.sale.create({
      data: {
        organizationId: org.id,
        saleNumber: seq,
        status: "COMPLETED",
        subtotal: 25,
        total: 25,
        paymentMethod: "PIX",
        items: {
          create: [
            {
              productId: p.id,
              productName: p.name,
              quantity: 1,
              unitPrice: 25,
              total: 25,
            },
          ],
        },
        payments: { create: [{ method: "PIX", amount: 25 }] },
      },
    });
  }

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Mercadinho A");
    orgB = await createOrg("Mercadinho B");
    ownerA = await createUser();
    ownerB = await createUser();
    await prisma.member.createMany({
      data: [
        { organizationId: orgA.id, userId: ownerA.id, role: "owner" },
        { organizationId: orgB.id, userId: ownerB.id, role: "owner" },
      ],
    });
  });

  beforeEach(async () => {
    fila.send.mockClear();
    const orgs = { organizationId: { in: [orgA.id, orgB.id] } };
    await prisma.fiscalDocument.deleteMany({ where: orgs });
    await prisma.fiscalSeries.deleteMany({ where: orgs });
    await prisma.sale.deleteMany({ where: orgs });
    await prisma.product.deleteMany({ where: orgs });
    await prisma.fiscalConfig.deleteMany({ where: orgs });
  });

  it("situação: só pode emitir com a empresa configurada", async () => {
    expect(
      await call(fiscalRoutes.situacao, {}, ctx(ownerA, orgA)),
    ).toMatchObject({
      podeEmitir: false,
      motivo: "Emissão fiscal não configurada",
    });
    await configurar(orgA);
    expect(
      await call(fiscalRoutes.situacao, {}, ctx(ownerA, orgA)),
    ).toMatchObject({
      podeEmitir: true,
      simulado: true,
    });
  });

  it("emite, autoriza na hora e grava chave, protocolo, QR e o conteúdo enviado", async () => {
    await configurar(orgA);
    const venda = await vender(orgA, ownerA);

    const doc = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );
    expect(doc).toMatchObject({
      status: "AUTHORIZED",
      serie: 1,
      numero: 1,
      ambiente: "HOMOLOGACAO",
    });
    expect(doc.chave).toHaveLength(44);
    expect(doc.qrCodeUrl).toContain(doc.chave);
    // Autorizou na tentativa imediata: nada foi para a fila.
    expect(fila.send).not.toHaveBeenCalled();

    const linha = await prisma.fiscalDocument.findFirstOrThrow({
      where: { id: doc.id },
    });
    expect(linha).toMatchObject({
      emitterCnpj: "11222333000181",
      type: "NFCE",
      tpEmis: 1,
    });
    expect(linha.nota).toMatchObject({
      modelo: 65,
      itens: [{ ncm: "10063021", cfop: "5102" }],
    });
  });

  it("emitir de novo a mesma venda devolve a mesma nota", async () => {
    await configurar(orgA);
    const venda = await vender(orgA, ownerA);
    const a = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );
    const b = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );
    expect(b.id).toBe(a.id);
    expect(
      await prisma.fiscalDocument.count({ where: { saleId: venda.id } }),
    ).toBe(1);
  });

  it("numeração por série segue em sequência e respeita o número inicial da config", async () => {
    await configurar(orgA, { nfceNextNumber: 500 });
    const v1 = await vender(orgA, ownerA);
    const v2 = await vender(orgA, ownerA);
    const d1 = await call(
      fiscalRoutes.emitirNfce,
      { saleId: v1.id },
      ctx(ownerA, orgA),
    );
    const d2 = await call(
      fiscalRoutes.emitirNfce,
      { saleId: v2.id },
      ctx(ownerA, orgA),
    );
    expect([d1.numero, d2.numero]).toEqual([500, 501]);
  });

  it("cadastro incompleto não cria documento nem gasta número", async () => {
    await configurar(orgA);
    const venda = await vender(orgA, ownerA, { ncm: null });
    await expect(
      call(fiscalRoutes.emitirNfce, { saleId: venda.id }, ctx(ownerA, orgA)),
    ).rejects.toThrow(/Sem NCM/);
    expect(
      await prisma.fiscalDocument.count({ where: { saleId: venda.id } }),
    ).toBe(0);
    expect(
      await prisma.fiscalSeries.count({ where: { organizationId: orgA.id } }),
    ).toBe(0);
  });

  it("CPF na nota vai para o destinatário; CPF inválido é recusado", async () => {
    await configurar(orgA);
    const venda = await vender(orgA, ownerA);
    await expect(
      call(
        fiscalRoutes.emitirNfce,
        { saleId: venda.id, cpfCnpj: "123" },
        ctx(ownerA, orgA),
      ),
    ).rejects.toThrow(/inválido/);
    const doc = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id, cpfCnpj: "529.982.247-25" },
      ctx(ownerA, orgA),
    );
    expect(doc.destinatario).toBe("52998224725");
  });

  it("outra empresa não emite nem enxerga a nota da venda", async () => {
    await configurar(orgA);
    await configurar(orgB);
    const venda = await vender(orgA, ownerA);
    await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );

    expect(
      await call(fiscalRoutes.daVenda, { saleId: venda.id }, ctx(ownerB, orgB)),
    ).toBeNull();
    await expect(
      call(fiscalRoutes.emitirNfce, { saleId: venda.id }, ctx(ownerB, orgB)),
    ).rejects.toThrow(/Venda não encontrada/);
  });

  it("cancela a nota autorizada; depois disso a venda pode emitir outra", async () => {
    await configurar(orgA);
    const venda = await vender(orgA, ownerA);
    const doc = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );

    const cancelado = await call(
      fiscalRoutes.cancelar,
      {
        documentoId: doc.id,
        justificativa: "Cliente desistiu da compra no caixa",
      },
      ctx(ownerA, orgA),
    );
    expect(cancelado).toMatchObject({
      status: "CANCELLED",
      temXmlCancelamento: true,
    });
    // Sem nota vigente, a tela mostra a cancelada em vez de "emitindo…".
    expect(
      await call(fiscalRoutes.daVenda, { saleId: venda.id }, ctx(ownerA, orgA)),
    ).toMatchObject({ id: doc.id, status: "CANCELLED" });

    const nova = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );
    expect(nova.id).not.toBe(doc.id);
    expect(nova.numero).toBe(2);
  });
});
