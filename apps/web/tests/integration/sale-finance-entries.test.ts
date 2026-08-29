import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSale } from "@/app/router/sales/create";
import { listEntries } from "@/app/router/financeiro/entries";
import type { Organization, Product, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, s2sContext } from "./helpers";

/**
 * O caminho venda → Financeiro só tinha teste UNITÁRIO (`buildSaleEntries`),
 * que confere o formato dos lançamentos e não prova que eles chegam ao banco
 * nem que voltam na listagem. Foi nessa fresta que o bug de "vendi e não
 * apareceu no Financeiro" passou.
 *
 * Aqui o teste vai de ponta a ponta: chama a procedure real que o PDV do
 * navegador usa e cobra o lançamento pela MESMA listagem que a tela consulta.
 */
describe("venda concluída lança no Financeiro", () => {
  let org: Organization;
  let user: User;
  let produto: Product;

  beforeAll(async () => {
    org = await createOrg("Loja do teste");
    user = await createUser();
    const member = await createMember(user, org);

    produto = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: "Arroz 5kg",
        slug: `arroz-${Math.random().toString(36).slice(2)}`,
        salePrice: 30,
        costPrice: 20,
        createdById: user.id,
        trackStock: true,
        currentStock: 50,
      },
    });

    // Venda exige caixa aberto do operador — sem isso a procedure recusa antes
    // de chegar ao financeiro.
    const register = await prisma.cashRegister.create({
      data: { organizationId: org.id, name: "Caixa 01" },
    });
    await prisma.cashSession.create({
      data: {
        organizationId: org.id,
        // A procedure procura a sessão pelo MEMBER do operador, não pelo user.
        memberId: member.id,
        registerId: register.id,
        openedById: user.id,
        openingBalance: 0,
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    await prisma.paymentEntry.deleteMany({ where: { organizationId: org.id } });
    await prisma.sale.deleteMany({ where: { organizationId: org.id } });
  });

  it("grava receita e CMV, e a listagem do Financeiro os devolve", async () => {
    await call(
      createSale,
      {
        subtotal: 60,
        discount: 0,
        total: 60,
        status: "COMPLETED" as const,
        payments: [{ method: "DINHEIRO" as const, amount: 60 }],
        items: [
          {
            productId: produto.id,
            productName: produto.name,
            quantity: 2,
            unitPrice: 30,
          },
        ],
      },
      { context: s2sContext(user, org) },
    );

    const noBanco = await prisma.paymentEntry.findMany({
      where: { organizationId: org.id },
      select: { type: true, amount: true, status: true, saleId: true },
    });
    expect(noBanco.length).toBeGreaterThan(0);

    // A tela do Financeiro não lê a tabela direto: passa por esta procedure.
    // Um lançamento gravado mas invisível na listagem é o mesmo que inexistente
    // para quem usa o sistema.
    const { entries } = await call(
      listEntries,
      { limit: 100 },
      { context: s2sContext(user, org) },
    );
    const daVenda = entries.filter((e) => e.description.includes("Venda"));
    expect(daVenda.length).toBeGreaterThan(0);
  });
});
