import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detalharClienteFv } from "@/app/router/forca-vendas/clientes/detalhe";
import { listarCarteiraFv } from "@/app/router/forca-vendas/clientes/listar";
import { enviarPedidoFv } from "@/app/router/forca-vendas/pedidos/enviar";
import { listarPedidosFv } from "@/app/router/forca-vendas/pedidos/listar";
import { listarPedidosGestao } from "@/app/router/forca-vendas-gestao/pedidos/listar";
import type {
  Customer,
  Organization,
  Product,
  User,
} from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * A Força de Vendas acrescenta um segundo escopo por cima do da organização:
 * o vendedor só enxerga a própria carteira, o supervisor a da equipe. As duas
 * camadas são manuais — este arquivo prova as duas, como o
 * `supplier-list.test.ts` prova a primeira.
 */
describe("Força de Vendas: organização e carteira", () => {
  let orgA: Organization;
  let orgB: Organization;
  let vendedorA: User;
  let vendedorB: User;
  let supervisor: User;
  let donoB: User;
  let clienteA: Customer;
  let clienteB: Customer;
  let clienteOutraOrg: Customer;
  let produto: Product;

  async function membroDeCampo(
    user: User,
    org: Organization,
    extra: {
      supervisorId?: string;
      tradeRole?: "SUPERVISOR" | "VENDEDOR";
    } = {},
  ) {
    return prisma.member.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "member",
        permissions: ["forca-vendas"],
        tradeRole: extra.tradeRole ?? "VENDEDOR",
        supervisorId: extra.supervisorId,
      },
    });
  }

  beforeAll(async () => {
    await resetDb();
    orgA = await createOrg("Distribuidora A");
    orgB = await createOrg("Distribuidora B");
    vendedorA = await createUser();
    vendedorB = await createUser();
    supervisor = await createUser();
    donoB = await createUser();

    const membroSupervisor = await membroDeCampo(supervisor, orgA, {
      tradeRole: "SUPERVISOR",
    });
    const membroA = await membroDeCampo(vendedorA, orgA, {
      supervisorId: membroSupervisor.id,
    });
    const membroB = await membroDeCampo(vendedorB, orgA);
    await createMember(donoB, orgB);

    clienteA = await prisma.customer.create({
      data: { organizationId: orgA.id, name: "Mercadinho do A" },
    });
    clienteB = await prisma.customer.create({
      data: { organizationId: orgA.id, name: "Mercadinho do B" },
    });
    clienteOutraOrg = await prisma.customer.create({
      data: { organizationId: orgB.id, name: "Cliente da outra org" },
    });
    await prisma.carteiraCliente.createMany({
      data: [
        {
          organizationId: orgA.id,
          customerId: clienteA.id,
          memberId: membroA.id,
        },
        {
          organizationId: orgA.id,
          customerId: clienteB.id,
          memberId: membroB.id,
        },
      ],
    });

    produto = await prisma.product.create({
      data: {
        organizationId: orgA.id,
        name: "Óleo de soja 900 ml",
        slug: `oleo-${orgA.id}`,
        salePrice: 7.89,
        currentStock: 100,
        createdById: vendedorA.id,
      },
    });
  });

  afterAll(resetDb);

  it("o vendedor vê só a própria carteira", async () => {
    const resultado = await call(
      listarCarteiraFv,
      { limite: 20 },
      { context: s2sContext(vendedorA, orgA) },
    );
    expect(resultado.clientes.map((cliente) => cliente.nome)).toEqual([
      "Mercadinho do A",
    ]);
  });

  it("o supervisor vê a carteira da equipe e não a de quem não é dele", async () => {
    const resultado = await call(
      listarCarteiraFv,
      { limite: 20 },
      { context: s2sContext(supervisor, orgA) },
    );
    expect(resultado.clientes.map((cliente) => cliente.nome)).toEqual([
      "Mercadinho do A",
    ]);
  });

  it("abrir pelo id o cliente do colega ou de outra org dá não encontrado", async () => {
    await expect(
      call(
        detalharClienteFv,
        { customerId: clienteB.id },
        { context: s2sContext(vendedorA, orgA) },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      call(
        detalharClienteFv,
        { customerId: clienteOutraOrg.id },
        { context: s2sContext(vendedorA, orgA) },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("pedido para cliente fora da carteira é recusado", async () => {
    await expect(
      call(
        enviarPedidoFv,
        {
          customerId: clienteB.id,
          tipo: "VENDA",
          itens: [{ productId: produto.id, quantidade: 1 }],
        },
        { context: s2sContext(vendedorA, orgA) },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("pedido da carteira entra, e reenviar com o mesmo id não duplica", async () => {
    const entrada = {
      customerId: clienteA.id,
      tipo: "VENDA" as const,
      clientOperationId: crypto.randomUUID(),
      itens: [{ productId: produto.id, quantidade: 2 }],
    };
    const primeiro = await call(enviarPedidoFv, entrada, {
      context: s2sContext(vendedorA, orgA),
    });
    const segundo = await call(enviarPedidoFv, entrada, {
      context: s2sContext(vendedorA, orgA),
    });
    expect(segundo.saleId).toBe(primeiro.saleId);
    expect(primeiro.status).toBe("CONFIRMED");
  });

  it("o colega e a outra organização não veem o pedido", async () => {
    const doColega = await call(
      listarPedidosFv,
      { apenasMeus: false, limite: 20 },
      { context: s2sContext(vendedorB, orgA) },
    );
    expect(doColega.pedidos).toHaveLength(0);

    const outraOrg = await call(
      listarPedidosGestao,
      { limite: 20 },
      { context: s2sContext(donoB, orgB) },
    );
    expect(outraOrg.pedidos).toHaveLength(0);
  });

  it("vendedor sem a gestão não abre o receptor", async () => {
    await expect(
      call(
        listarPedidosGestao,
        { limite: 20 },
        { context: s2sContext(vendedorA, orgA) },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
