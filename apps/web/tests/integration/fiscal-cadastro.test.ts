import { call } from "@orpc/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fiscalConfigRoutes } from "@/app/router/fiscal-config";
import { productsRoutes } from "@/app/router/products";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createOrg, createUser, resetDb, s2sContext } from "./helpers";

/**
 * Fase 1 do fiscal (specs/fiscal-nfce.md): validação do cadastro, padrões da
 * empresa, prontidão e edição em lote — sempre conferindo que uma empresa não
 * enxerga nem altera os produtos da outra.
 */
describe("cadastro fiscal", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ownerA: User;
  let ownerB: User;

  const ctxA = () => ({ context: s2sContext(ownerA, orgA) });

  async function produto(org: Organization, nome: string, dados = {}) {
    return prisma.product.create({
      data: {
        organizationId: org.id,
        name: nome,
        slug: `${nome.toLowerCase().replace(/\W+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`,
        costPrice: 1,
        salePrice: 2,
        createdById: org.id === orgA.id ? ownerA.id : ownerB.id,
        ...dados,
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
    await prisma.product.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.fiscalConfig.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.fiscalConfig.create({
      data: { organizationId: orgA.id, taxRegime: "SIMPLES_NACIONAL" },
    });
  });

  describe("padrões de tributação", () => {
    it("salva os padrões e o taxProfile devolve sem exigir owner", async () => {
      await call(
        fiscalConfigRoutes.upsert,
        {
          defaultCfop: "5102",
          defaultCstIcms: "102",
          defaultCstPis: "49",
          defaultCstCofins: "49",
        },
        ctxA(),
      );
      const perfil = await call(fiscalConfigRoutes.taxProfile, {}, ctxA());
      expect(perfil).toEqual({
        regime: "SIMPLES_NACIONAL",
        padroes: {
          cfop: "5102",
          cstIcms: "102",
          cstPis: "49",
          cstCofins: "49",
        },
        sugestao: {
          cfop: "5102",
          cstIcms: "102",
          cstPis: "49",
          cstCofins: "49",
        },
      });
    });

    it("recusa CST de Regime Normal como padrão de empresa do Simples", async () => {
      await expect(
        call(fiscalConfigRoutes.upsert, { defaultCstIcms: "00" }, ctxA()),
      ).rejects.toThrow(/Simples usa CSOSN/);
    });
  });

  describe("produto", () => {
    it("normaliza o NCM com pontuação e recusa formato inválido", async () => {
      const p = await produto(orgA, "Refrigerante");
      await call(
        productsRoutes.update,
        {
          id: p.id,
          name: p.name,
          costPrice: 1,
          salePrice: 2,
          images: [],
          ncm: "2202.10.00",
        },
        ctxA(),
      );
      expect(
        (await prisma.product.findUnique({ where: { id: p.id } }))?.ncm,
      ).toBe("22021000");

      await expect(
        call(
          productsRoutes.update,
          {
            id: p.id,
            name: p.name,
            costPrice: 1,
            salePrice: 2,
            images: [],
            cfop: "1102",
          },
          ctxA(),
        ),
      ).rejects.toThrow(/CFOP/);
    });

    it("apagar o CFOP limpa o campo (o produto volta ao padrão)", async () => {
      const p = await produto(orgA, "Arroz", { cfop: "5405" });
      await call(
        productsRoutes.update,
        {
          id: p.id,
          name: p.name,
          costPrice: 1,
          salePrice: 2,
          images: [],
          cfop: "",
        },
        ctxA(),
      );
      expect(
        (await prisma.product.findUnique({ where: { id: p.id } }))?.cfop,
      ).toBeNull();
    });
  });

  describe("prontidão", () => {
    it("conta prontos com o padrão da empresa e lista o que falta, só da própria empresa", async () => {
      await prisma.fiscalConfig.update({
        where: { organizationId: orgA.id },
        data: {
          defaultCfop: "5102",
          defaultCstIcms: "102",
          defaultCstPis: "49",
          defaultCstCofins: "49",
        },
      });
      await produto(orgA, "Pronto pelo padrão", { ncm: "10063021" });
      await produto(orgA, "Sem NCM");
      await produto(orgA, "NCM errado", { ncm: "123" });
      await produto(orgA, "Inativo", { isActive: false });
      await produto(orgB, "Da outra empresa");

      const r = await call(productsRoutes.fiscalReadiness, {}, ctxA());
      expect(r).toMatchObject({
        regime: "SIMPLES_NACIONAL",
        total: 3,
        prontos: 1,
        pendentes: 2,
        porCampo: { ncm: 1, formato: 1 },
        truncado: false,
      });
      expect(r.itens.map((i) => i.name).sort()).toEqual([
        "NCM errado",
        "Sem NCM",
      ]);
    });
  });

  describe("edição em lote", () => {
    it("aplica só nos produtos da própria empresa", async () => {
      const a = await produto(orgA, "A");
      const b = await produto(orgB, "B");
      const r = await call(
        productsRoutes.bulkUpdateFiscal,
        {
          productIds: [a.id, b.id],
          patch: { ncm: "1006.30.21", cstIcms: "500" },
        },
        ctxA(),
      );
      expect(r.updated).toBe(1);
      expect(
        await prisma.product.findUnique({ where: { id: a.id } }),
      ).toMatchObject({
        ncm: "10063021",
        cstIcms: "500",
      });
      expect(
        (await prisma.product.findUnique({ where: { id: b.id } }))?.ncm,
      ).toBeNull();
    });

    it("valida antes de gravar", async () => {
      const a = await produto(orgA, "A");
      await expect(
        call(
          productsRoutes.bulkUpdateFiscal,
          { productIds: [a.id], patch: { cstIcms: "00" } },
          ctxA(),
        ),
      ).rejects.toThrow(/CSOSN/);
    });
  });
});
