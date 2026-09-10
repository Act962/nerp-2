import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirToolsDoApp } from "@/features/astro/server/tools-app";
import { lerTabelaDePrecos } from "@/features/astro-consultor/server/preco";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, resetDb } from "./helpers";

/**
 * As tools de leitura do Astro.
 *
 * Dois testes em um: os números batem com o que foi semeado, e NADA da outra
 * organização aparece. O isolamento é estrutural (o `organizationId` vive na
 * closure), mas é aqui que ele deixa de ser promessa — cada tool nova entra
 * nesta suíte antes de entrar no registro.
 */

const DIA_MS = 86_400_000;

let orgA: Organization;
let orgB: Organization;
let donoA: User;
let donoB: User;

type Executar = (
  entrada: unknown,
  opcoes: { toolCallId: string; messages: never[] },
) => Promise<unknown>;

function toolsDe(org: Organization, dono: User) {
  return construirToolsDoApp({
    organizationId: org.id,
    userId: dono.id,
    sessaoId: `sessao-${org.id}`,
    tabelaPrecos: lerTabelaDePrecos(undefined),
    falaDoVisitante: "",
  });
}

async function chamar<T = Record<string, unknown>>(
  org: Organization,
  dono: User,
  nome: string,
  entrada: unknown = {},
): Promise<T> {
  const ferramenta = toolsDe(org, dono)[nome];
  if (!ferramenta?.execute) throw new Error(`tool ${nome} sem execute`);
  return (ferramenta.execute as unknown as Executar)(entrada, {
    toolCallId: "chamada",
    messages: [],
  }) as Promise<T>;
}

/** Uma organização com produtos, clientes e vendas em datas conhecidas. */
async function semear(org: Organization, dono: User, marca: string) {
  const categoria = await prisma.category.create({
    data: {
      organizationId: org.id,
      name: `Categoria ${marca}`,
      slug: `cat-${marca}`,
    },
  });
  const caro = await prisma.product.create({
    data: {
      organizationId: org.id,
      createdById: dono.id,
      categoryId: categoria.id,
      name: `Produto caro ${marca}`,
      slug: `caro-${marca}`,
      salePrice: 100,
      costPrice: 60,
      currentStock: 50,
      minStock: 5,
    },
  });
  const acabando = await prisma.product.create({
    data: {
      organizationId: org.id,
      createdById: dono.id,
      name: `Produto acabando ${marca}`,
      slug: `acabando-${marca}`,
      salePrice: 10,
      costPrice: 4,
      currentStock: 1,
      minStock: 20,
    },
  });
  const parado = await prisma.product.create({
    data: {
      organizationId: org.id,
      createdById: dono.id,
      name: `Produto parado ${marca}`,
      slug: `parado-${marca}`,
      salePrice: 30,
      costPrice: 15,
      currentStock: 40,
      minStock: 1,
    },
  });

  const fiel = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: `Cliente fiel ${marca}`,
      email: `fiel-${marca}@teste.local`,
    },
  });
  const sumido = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: `Cliente sumido ${marca}`,
      email: `sumido-${marca}@teste.local`,
    },
  });

  const agora = new Date();
  const venda = async (
    numero: number,
    quando: Date,
    customerId: string,
    itens: { produtoId: string; nome: string; qtd: number; preco: number }[],
    status: "COMPLETED" | "DRAFT" | "CANCELLED" = "COMPLETED",
  ) => {
    const total = itens.reduce((s, i) => s + i.qtd * i.preco, 0);
    await prisma.sale.create({
      data: {
        organizationId: org.id,
        customerId,
        saleNumber: numero,
        status,
        subtotal: total,
        total,
        createdAt: quando,
        completedAt: status === "COMPLETED" ? quando : null,
        items: {
          create: itens.map((item) => ({
            productId: item.produtoId,
            productName: item.nome,
            quantity: item.qtd,
            unitPrice: item.preco,
            total: item.qtd * item.preco,
          })),
        },
      },
    });
  };

  // Fiel compra três vezes na semana; sumido comprou há 120 dias.
  await venda(1, new Date(agora.getTime() - 1 * DIA_MS), fiel.id, [
    { produtoId: caro.id, nome: caro.name, qtd: 2, preco: 100 },
  ]);
  await venda(2, new Date(agora.getTime() - 2 * DIA_MS), fiel.id, [
    { produtoId: caro.id, nome: caro.name, qtd: 1, preco: 100 },
    { produtoId: acabando.id, nome: acabando.name, qtd: 5, preco: 10 },
  ]);
  await venda(3, new Date(agora.getTime() - 3 * DIA_MS), fiel.id, [
    { produtoId: acabando.id, nome: acabando.name, qtd: 1, preco: 10 },
  ]);
  await venda(4, new Date(agora.getTime() - 120 * DIA_MS), sumido.id, [
    { produtoId: parado.id, nome: parado.name, qtd: 1, preco: 30 },
  ]);
  // Rascunho e cancelada não contam em lugar nenhum.
  await venda(
    5,
    new Date(agora.getTime() - 1 * DIA_MS),
    fiel.id,
    [{ produtoId: caro.id, nome: caro.name, qtd: 99, preco: 100 }],
    "DRAFT",
  );
  await venda(
    6,
    new Date(agora.getTime() - 1 * DIA_MS),
    fiel.id,
    [{ produtoId: caro.id, nome: caro.name, qtd: 99, preco: 100 }],
    "CANCELLED",
  );
}

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org A do Astro");
  orgB = await createOrg("Org B do Astro");
  donoA = await createUser();
  donoB = await createUser();
  await createMember(donoA, orgA);
  await createMember(donoB, orgB);
  await semear(orgA, donoA, "A");
  await semear(orgB, donoB, "B");
});

afterAll(resetDb);

describe("isolamento entre organizações", () => {
  it("nenhuma tool aceita organizationId como argumento", () => {
    const tools = toolsDe(orgA, donoA);
    for (const [nome, ferramenta] of Object.entries(tools)) {
      const schema = JSON.stringify(ferramenta.inputSchema ?? {});
      expect(schema, nome).not.toMatch(/organizationId/i);
    }
  });

  it("nenhuma resposta da org A menciona a org B", async () => {
    const chamadas: [string, unknown][] = [
      ["minhaOperacao", {}],
      ["contarCadastros", {}],
      ["buscarProdutos", { termo: "Produto" }],
      ["resumoDeVendas", { periodo: "30d" }],
      ["serieDeVendas", { periodo: "7d" }],
      ["produtosMaisVendidos", { periodo: "30d" }],
      ["topClientes", { periodo: "30d" }],
      ["clientesInativos", { diasSemComprar: 30 }],
      ["historicoDoCliente", { termo: "Cliente" }],
      ["estoqueBaixo", {}],
      ["estoqueParado", { diasSemVender: 30 }],
      ["coberturaDeEstoque", {}],
      ["previsaoDeVendas", { horizonteDias: 7 }],
      ["proximosEventos", { dias: 30 }],
      ["painelDeTrade", {}],
      ["contratosVencendo", { dias: 60 }],
      ["listarCatalogosPromocionais", {}],
      ["previaDeCatalogo", {}],
      ["estadoDoWhatsapp", {}],
      ["extratoDeStars", {}],
      ["consumoDoAstro", { periodo: "30d" }],
    ];

    for (const [nome, entrada] of chamadas) {
      const saida = JSON.stringify(await chamar(orgA, donoA, nome, entrada));
      expect(saida, `${nome} vazou a org B`).not.toContain(orgB.id);
      expect(saida, `${nome} vazou nome da org B`).not.toMatch(
        / B\b|-B\b|Org B/,
      );
    }
  });
});

describe("vendas", () => {
  it("soma só o que é venda de verdade e compara com o período anterior", async () => {
    const resumo = await chamar<{
      totalVendido: number;
      quantidadeDeVendas: number;
      ticketMedio: number;
      comparacao: { totalAnterior: number };
    }>(orgA, donoA, "resumoDeVendas", { periodo: "7d" });

    // 200 + 150 + 10 = 360 em três vendas; o rascunho e a cancelada ficam fora.
    expect(resumo.totalVendido).toBe(360);
    expect(resumo.quantidadeDeVendas).toBe(3);
    expect(resumo.ticketMedio).toBe(120);
  });

  it("a série tem um ponto por dia com venda", async () => {
    const serie = await chamar<{ pontos: { data: string; total: number }[] }>(
      orgA,
      donoA,
      "serieDeVendas",
      { periodo: "7d" },
    );
    expect(serie.pontos).toHaveLength(3);
    expect(serie.pontos.reduce((s, p) => s + p.total, 0)).toBe(360);
  });

  it("os mais vendidos vêm por valor, e o item passa pela venda da org", async () => {
    const mais = await chamar<{
      produtos: { nome: string; quantidade: number }[];
    }>(orgA, donoA, "produtosMaisVendidos", { periodo: "30d" });
    expect(mais.produtos[0]?.nome).toBe("Produto caro A");
    expect(mais.produtos[0]?.quantidade).toBe(3);
  });
});

describe("clientes", () => {
  it("top clientes traz quem comprou, com ticket médio", async () => {
    const top = await chamar<{
      clientes: { nome: string; compras: number; total: number }[];
    }>(orgA, donoA, "topClientes", { periodo: "30d" });
    expect(top.clientes).toHaveLength(1);
    expect(top.clientes[0]?.nome).toBe("Cliente fiel A");
    expect(top.clientes[0]?.compras).toBe(3);
    expect(top.clientes[0]?.total).toBe(360);
  });

  it("inativos pega quem sumiu e não quem comprou ontem", async () => {
    const inativos = await chamar<{
      clientes: { nome: string; diasSemComprar: number | null }[];
    }>(orgA, donoA, "clientesInativos", { diasSemComprar: 60 });
    expect(inativos.clientes.map((c) => c.nome)).toEqual(["Cliente sumido A"]);
    expect(inativos.clientes[0]?.diasSemComprar).toBeGreaterThan(100);
  });

  it("histórico do cliente soma as compras dele", async () => {
    const historico = await chamar<{
      cliente: { nome: string };
      compras: number;
      totalGasto: number;
      recentes: unknown[];
    }>(orgA, donoA, "historicoDoCliente", { termo: "fiel A" });
    expect(historico.cliente.nome).toBe("Cliente fiel A");
    expect(historico.compras).toBe(3);
    expect(historico.totalGasto).toBe(360);
    expect(historico.recentes).toHaveLength(3);
  });

  it("cliente inexistente devolve erro legível, não lista vazia", async () => {
    const nada = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "historicoDoCliente",
      { termo: "zzzzz" },
    );
    expect(nada.erro).toMatch(/Nenhum cliente/);
  });
});

describe("estoque", () => {
  it("baixo é estoque menor ou igual ao mínimo", async () => {
    const baixo = await chamar<{ produtos: { nome: string }[] }>(
      orgA,
      donoA,
      "estoqueBaixo",
      {},
    );
    expect(baixo.produtos.map((p) => p.nome)).toEqual(["Produto acabando A"]);
  });

  it("parado é o que tem estoque e não vendeu no período", async () => {
    const parado = await chamar<{
      produtos: { nome: string; valorParado: number }[];
    }>(orgA, donoA, "estoqueParado", { diasSemVender: 30 });
    expect(parado.produtos.map((p) => p.nome)).toEqual(["Produto parado A"]);
    expect(parado.produtos[0]?.valorParado).toBe(600);
  });

  it("cobertura divide o estoque pela saída média", async () => {
    const cobertura = await chamar<{
      produtos: { nome: string; diasDeCobertura: number | null }[];
    }>(orgA, donoA, "coberturaDeEstoque", { termo: "acabando" });
    const acabando = cobertura.produtos[0];
    expect(acabando?.nome).toBe("Produto acabando A");
    // 6 unidades em 30 dias = 0,2/dia; 1 em estoque ⇒ 5 dias.
    expect(acabando?.diasDeCobertura).toBe(5);
  });
});

describe("operação", () => {
  it("minhaOperacao devolve a organização da closure, com plano e ★", async () => {
    const operacao = await chamar<{
      organizacao: string;
      contaDeTeste: boolean;
      plano: { nome: string };
      stars: { saldo: number };
      cadastros: { produtos: { reais: number } };
    }>(orgA, donoA, "minhaOperacao");
    expect(operacao.organizacao).toBe(orgA.name);
    expect(operacao.plano.nome).toBeTruthy();
    expect(operacao.cadastros.produtos.reais).toBe(3);
  });

  it("previsão declara o método e a fonte", async () => {
    const previsao = await chamar<{
      metodo: string;
      fonte: string;
      confianca: string;
      dias: unknown[];
    }>(orgA, donoA, "previsaoDeVendas", { horizonteDias: 7 });
    expect(previsao.dias).toHaveLength(7);
    expect(previsao.metodo).toBeTruthy();
    expect(previsao.fonte).toMatch(/nerp/);
    expect(["baixa", "media", "alta"]).toContain(previsao.confianca);
  });

  it("WhatsApp sem número diz por que não dá para disparar", async () => {
    const estado = await chamar<{
      temNumeroAtivo: boolean;
      podeDisparar: boolean;
      motivoSeNaoPode: string | null;
    }>(orgA, donoA, "estadoDoWhatsapp");
    expect(estado.temNumeroAtivo).toBe(false);
    expect(estado.podeDisparar).toBe(false);
    expect(estado.motivoSeNaoPode).toMatch(/número/i);
  });
});
