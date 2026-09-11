import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removerDadosDeExemplo } from "@/app/router/onboarding/remover-dados-de-exemplo";
import { status } from "@/app/router/onboarding/status";
import { contarRecurso } from "@/features/billing/server/limites";
import { seedDemoDataForOrg } from "@/features/onboarding/server/seed-demo";
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
 * Dados de exemplo da organização nova: nascem uma vez, não contam no plano,
 * e saem inteiros — menos o que já ganhou movimento de verdade.
 */

let org: Organization;
let dono: User;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Org que nasce com exemplo");
  dono = await createUser();
  await createMember(dono, org);
});

afterAll(resetDb);

describe("seedDemoDataForOrg", () => {
  it("semeia produtos, clientes, fornecedores, loja e catálogo marcados como exemplo", async () => {
    const resultado = await seedDemoDataForOrg(org.id, dono.id);
    expect(resultado.criou).toBe(true);

    const [produtos, clientes, fornecedores, lojas, catalogos, categorias] =
      await Promise.all([
        prisma.product.count({ where: { organizationId: org.id } }),
        prisma.customer.count({ where: { organizationId: org.id } }),
        prisma.supplier.count({ where: { organizationId: org.id } }),
        prisma.store.count({ where: { organizationId: org.id } }),
        prisma.promotionalCatalog.count({ where: { organizationId: org.id } }),
        prisma.category.count({ where: { organizationId: org.id } }),
      ]);
    expect(produtos).toBe(10);
    expect(clientes).toBe(5);
    expect(fornecedores).toBe(3);
    expect(lojas).toBe(1);
    expect(catalogos).toBe(1);
    expect(categorias).toBe(3);

    const semMarca = await prisma.product.count({
      where: { organizationId: org.id, isDemo: false },
    });
    expect(semMarca).toBe(0);
  });

  it("não conta no limite do plano", async () => {
    expect(await contarRecurso(org.id, "produtos")).toBe(0);
    expect(await contarRecurso(org.id, "clientes")).toBe(0);
    expect(await contarRecurso(org.id, "fornecedores")).toBe(0);
    expect(await contarRecurso(org.id, "lojas")).toBe(0);
  });

  it("é idempotente", async () => {
    const segunda = await seedDemoDataForOrg(org.id, dono.id);
    expect(segunda.criou).toBe(false);
    expect(
      await prisma.product.count({ where: { organizationId: org.id } }),
    ).toBe(10);
  });

  it("o status sabe que há exemplo", async () => {
    const resultado = await call(
      status,
      {},
      { context: s2sContext(dono, org) },
    );
    expect(resultado.temDadosDeExemplo).toBe(true);
    expect(resultado.exemplos.produtos).toBe(10);
  });
});

describe("removerDadosDeExemplo", () => {
  it("apaga o que é só exemplo e preserva o que já foi vendido", async () => {
    const vendido = await prisma.product.findFirstOrThrow({
      where: { organizationId: org.id, isDemo: true },
    });
    const cliente = await prisma.customer.findFirstOrThrow({
      where: { organizationId: org.id, isDemo: true },
    });
    // Uma venda de verdade com um produto de exemplo.
    await prisma.sale.create({
      data: {
        organizationId: org.id,
        customerId: cliente.id,
        saleNumber: 1,
        status: "COMPLETED",
        subtotal: 10,
        total: 10,
        completedAt: new Date(),
        items: {
          create: {
            productId: vendido.id,
            productName: vendido.name,
            quantity: 1,
            unitPrice: 10,
            total: 10,
          },
        },
      },
    });

    const resultado = await call(
      removerDadosDeExemplo,
      {},
      { context: s2sContext(dono, org) },
    );
    expect(resultado.produtos).toBe(9);
    expect(resultado.clientes).toBe(4);
    expect(resultado.mantidos).toBeGreaterThanOrEqual(2);

    const restante = await prisma.product.findUniqueOrThrow({
      where: { id: vendido.id },
      select: { isDemo: true },
    });
    expect(restante.isDemo).toBe(false);

    const aindaExemplo = await prisma.product.count({
      where: { organizationId: org.id, isDemo: true },
    });
    expect(aindaExemplo).toBe(0);

    const depois = await call(status, {}, { context: s2sContext(dono, org) });
    expect(depois.temDadosDeExemplo).toBe(false);
  });
});
