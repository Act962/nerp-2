import { call } from "@orpc/server";
import { unzipSync, strFromU8 } from "fflate";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, resetDb, s2sContext } from "./helpers";

/**
 * Fase 3 do fiscal (specs/fiscal-nfce.md): tela de notas, numeração com
 * números pulados, inutilização, alertas e o pacote mensal do contador. Com o
 * provedor simulado, como na Fase 2.
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
const { montarPacoteDoMes } = await import(
  "@/features/fiscal/server/exportacao"
);
const { lerArquivoFiscal } = await import("@/features/fiscal/server/container");

const JUSTIFICATIVA = "Números pulados por falha na transmissão";

describe("operação fiscal", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ownerA: User;
  let vendedorA: User;
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

  async function vender(org: Organization, dono: User, ncm = "10063021") {
    seq += 1;
    const p = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Feijão ${seq}`,
        slug: `feijao-${seq}-${Date.now()}`,
        costPrice: 5,
        salePrice: 12.5,
        createdById: dono.id,
        ncm,
      },
    });
    return prisma.sale.create({
      data: {
        organizationId: org.id,
        saleNumber: seq,
        status: "COMPLETED",
        subtotal: 12.5,
        total: 12.5,
        paymentMethod: "PIX",
        items: {
          create: [
            {
              productId: p.id,
              productName: p.name,
              quantity: 1,
              unitPrice: 12.5,
              total: 12.5,
            },
          ],
        },
        payments: { create: [{ method: "PIX", amount: 12.5 }] },
      },
    });
  }

  async function emitir(org: Organization, dono: User, ncm?: string) {
    const venda = await vender(org, dono, ncm);
    const doc = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(dono, org),
    );
    return { venda, doc };
  }

  /** Rejeitada "antiga": fora da janela de 24 h para reenvio. */
  async function envelhecer(documentoId: string) {
    await prisma.fiscalDocument.update({
      where: { id: documentoId },
      data: { lastAttemptAt: new Date(Date.now() - 2 * 86_400_000) },
    });
  }

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Mercadinho A");
    orgB = await createOrg("Mercadinho B");
    ownerA = await createUser();
    vendedorA = await createUser();
    ownerB = await createUser();
    await prisma.member.createMany({
      data: [
        { organizationId: orgA.id, userId: ownerA.id, role: "owner" },
        { organizationId: orgA.id, userId: vendedorA.id, role: "member" },
        { organizationId: orgB.id, userId: ownerB.id, role: "owner" },
      ],
    });
  });

  beforeEach(async () => {
    fila.send.mockClear();
    const orgs = { organizationId: { in: [orgA.id, orgB.id] } };
    await prisma.fiscalInutilizacao.deleteMany({ where: orgs });
    await prisma.fiscalDocument.deleteMany({ where: orgs });
    await prisma.fiscalSeries.deleteMany({ where: orgs });
    await prisma.sale.deleteMany({ where: orgs });
    await prisma.product.deleteMany({ where: orgs });
    await prisma.fiscalConfig.deleteMany({ where: orgs });
  });

  it("lista as notas da empresa com filtro por situação — e só as dela", async () => {
    await configurar(orgA);
    await configurar(orgB);
    await emitir(orgA, ownerA);
    await emitir(orgA, ownerA, "00000000");
    await emitir(orgB, ownerB);

    const todas = await call(fiscalRoutes.listar, {}, ctx(ownerA, orgA));
    expect(todas.itens).toHaveLength(2);
    expect(todas.itens[0]).toMatchObject({ totalCentavos: 1250 });

    const rejeitadas = await call(
      fiscalRoutes.listar,
      { status: "REJECTED" },
      ctx(ownerA, orgA),
    );
    expect(rejeitadas.itens).toHaveLength(1);
    expect(rejeitadas.itens[0].rejeicao?.codigo).toBe("778");
  });

  it("rejeitada antiga vira número pulado; inutilizar libera a venda para outra nota", async () => {
    // Faixa própria: o provedor simulado é um só no processo e já viu os nº 1
    // e 2 deste CNPJ nos outros testes — como a SEFAZ veria.
    await configurar(orgA, { nfceNextNumber: 7000 });
    const { venda, doc: rejeitada } = await emitir(orgA, ownerA, "00000000");
    await emitir(orgA, ownerA);

    // Recente: ainda dá para corrigir e reenviar, não aparece como pulado.
    expect(
      await call(fiscalRoutes.numeracao, {}, ctx(ownerA, orgA)),
    ).toMatchObject({ proximo: 7002, pulados: [] });

    await envelhecer(rejeitada.id);
    expect(
      await call(fiscalRoutes.numeracao, {}, ctx(ownerA, orgA)),
    ).toMatchObject({
      pulados: [{ inicio: 7000, fim: 7000 }],
      totalPulados: 1,
    });
    expect(await call(fiscalRoutes.alertas, {}, ctx(ownerA, orgA))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "NUMEROS_PULADOS" }),
      ]),
    );

    const r = await call(
      fiscalRoutes.inutilizar,
      { numeroInicial: 7000, numeroFinal: 7000, justificativa: JUSTIFICATIVA },
      ctx(ownerA, orgA),
    );
    expect(r.protocolo).toMatch(/^\d{15}$/);
    expect(
      await prisma.fiscalDocument.findUniqueOrThrow({
        where: { id: rejeitada.id },
      }),
    ).toMatchObject({ status: "VOIDED", inutilizacaoId: r.id });
    expect(
      await prisma.fiscalInutilizacao.findUniqueOrThrow({
        where: { id: r.id },
      }),
    ).toMatchObject({ createdById: ownerA.id, numeroInicial: 7000 });

    const numeracao = await call(fiscalRoutes.numeracao, {}, ctx(ownerA, orgA));
    expect(numeracao.pulados).toEqual([]);
    expect(numeracao.inutilizacoes).toHaveLength(1);

    // Corrigido o cadastro, o índice "um vigente por venda" deixa a mesma
    // venda emitir de novo, com número novo.
    await prisma.product.updateMany({
      where: { organizationId: orgA.id, ncm: "00000000" },
      data: { ncm: "10063021" },
    });
    const nova = await call(
      fiscalRoutes.emitirNfce,
      { saleId: venda.id },
      ctx(ownerA, orgA),
    );
    expect(nova).toMatchObject({ status: "AUTHORIZED", numero: 7002 });
  });

  it("não inutiliza número com nota autorizada nem número ainda não reservado", async () => {
    await configurar(orgA);
    await emitir(orgA, ownerA);
    await expect(
      call(
        fiscalRoutes.inutilizar,
        { numeroInicial: 1, numeroFinal: 1, justificativa: JUSTIFICATIVA },
        ctx(ownerA, orgA),
      ),
    ).rejects.toThrow(/nota autorizada/);
    await expect(
      call(
        fiscalRoutes.inutilizar,
        { numeroInicial: 5, numeroFinal: 9, justificativa: JUSTIFICATIVA },
        ctx(ownerA, orgA),
      ),
    ).rejects.toThrow(/próximo da série/);
  });

  it("inutilizar e cancelar são só para owner/admin", async () => {
    await configurar(orgA);
    const { doc } = await emitir(orgA, ownerA);
    await expect(
      call(
        fiscalRoutes.inutilizar,
        { numeroInicial: 1, numeroFinal: 1, justificativa: JUSTIFICATIVA },
        ctx(vendedorA, orgA),
      ),
    ).rejects.toThrow(/owner\/admin/);
    await expect(
      call(
        fiscalRoutes.cancelar,
        { documentoId: doc.id, justificativa: JUSTIFICATIVA },
        ctx(vendedorA, orgA),
      ),
    ).rejects.toThrow(/owner\/admin/);
  });

  it("cancelamento depois de 30 minutos é recusado sem ir à SEFAZ", async () => {
    await configurar(orgA);
    const { doc } = await emitir(orgA, ownerA);
    await prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: { authorizedAt: new Date(Date.now() - 31 * 60_000) },
    });
    await expect(
      call(
        fiscalRoutes.cancelar,
        { documentoId: doc.id, justificativa: JUSTIFICATIVA },
        ctx(ownerA, orgA),
      ),
    ).rejects.toThrow(/prazo para cancelar/);
  });

  it("alerta o certificado perto de vencer", async () => {
    await configurar(orgA, {
      certificateExpiresAt: new Date(Date.now() + 5 * 86_400_000),
    });
    const [alerta] = await call(fiscalRoutes.alertas, {}, ctx(ownerA, orgA));
    expect(alerta).toMatchObject({ tipo: "CERTIFICADO", nivel: "critico" });
  });

  it("pacote do mês traz os XMLs autorizados, cancelados e o resumo — só da empresa", async () => {
    await configurar(orgA);
    await configurar(orgB);
    const { doc: a } = await emitir(orgA, ownerA);
    const { doc: b } = await emitir(orgA, ownerA);
    await call(
      fiscalRoutes.cancelar,
      { documentoId: b.id, justificativa: JUSTIFICATIVA },
      ctx(ownerA, orgA),
    );
    await emitir(orgB, ownerB);

    const agora = new Date();
    const mes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
    }).format(agora);
    const { zip, notas } = await montarPacoteDoMes({
      organizationId: orgA.id,
      mes,
      ler: lerArquivoFiscal,
    });
    expect(notas).toBe(2);
    const arquivos = unzipSync(zip);
    expect(Object.keys(arquivos).sort()).toEqual(
      [
        `autorizadas/${a.chave}-nfce.xml`,
        `canceladas/${b.chave}-cancelamento.xml`,
        `canceladas/${b.chave}-nfce.xml`,
        "resumo.csv",
      ].sort(),
    );
    const resumo = strFromU8(arquivos["resumo.csv"]);
    expect(resumo).toContain(`${a.chave};autorizada`);
    expect(resumo).toContain("12,50");
  });
});
