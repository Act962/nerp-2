import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listSales } from "@/app/router/sales/list";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, s2sContext } from "./helpers";

/**
 * O filtro de período em /vendas nunca esteve ligado: o `<Select>` não tinha
 * ação, o front mandava as datas como `undefined` e o handler aceitava
 * `dateInit`/`dateEnd` no schema sem usar no `where`. Três camadas mudas.
 *
 * Este teste cobra o comportamento onde ele passou a existir — no servidor.
 */
describe("sales.list — recorte por período", () => {
  let org: Organization;
  let user: User;

  const agora = new Date();
  const ontem = new Date(agora.getTime() - 26 * 3600_000);
  const mesPassado = new Date(agora.getTime() - 40 * 86_400_000);

  async function venda(quando: Date, numero: number) {
    return prisma.sale.create({
      data: {
        organizationId: org.id,
        saleNumber: numero,
        createdById: user.id,
        subtotal: 10,
        discount: 0,
        total: 10,
        status: "COMPLETED",
        createdAt: quando,
      },
    });
  }

  beforeAll(async () => {
    org = await createOrg("Loja do período");
    user = await createUser();
    await createMember(user, org);
    await venda(agora, 1);
    await venda(ontem, 2);
    await venda(mesPassado, 3);
  });

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { organizationId: org.id } });
  });

  async function listar(period?: "today" | "week" | "month" | "all") {
    const { sales } = await call(
      listSales,
      period ? { period } : {},
      { context: s2sContext(user, org) },
    );
    return sales.map((s) => s.saleNumber).sort();
  }

  it('"hoje" traz só a venda de hoje', async () => {
    expect(await listar("today")).toEqual([1]);
  });

  it('"este mês" traz hoje e ontem, mas não a do mês passado', async () => {
    expect(await listar("month")).toEqual([1, 2]);
  });

  it('"todos" traz tudo', async () => {
    expect(await listar("all")).toEqual([1, 2, 3]);
  });

  // Sem período a lista não pode encolher: é o estado inicial da tela.
  it("sem período informado, não recorta", async () => {
    expect(await listar()).toEqual([1, 2, 3]);
  });

  it("não vaza venda de outra organização", async () => {
    const outra = await createOrg("Concorrente");
    const outroUser = await createUser();
    await createMember(outroUser, outra);
    await prisma.sale.create({
      data: {
        organizationId: outra.id,
        saleNumber: 99,
        createdById: outroUser.id,
        subtotal: 10,
        discount: 0,
        total: 10,
        status: "COMPLETED",
      },
    });

    expect(await listar("all")).toEqual([1, 2, 3]);

    await prisma.sale.deleteMany({ where: { organizationId: outra.id } });
  });
});
