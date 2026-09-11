import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirToolsDoApp } from "@/features/astro/server/tools-app";
import { lerTabelaDePrecos } from "@/features/astro-consultor/server/preco";
import type { Organization, User } from "@/generated/prisma/client";
import { emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, resetDb } from "./helpers";

/**
 * As tools que ESCREVEM.
 *
 * O que se garante aqui: a ação acontece na organização da closure, respeita a
 * mesma permissão da tela, cobra ★ só quando dá certo, e deixa rastro em
 * `AstroAcao` — inclusive quando falha.
 */

let orgA: Organization;
let orgB: Organization;
let donoA: User;
let membroSimples: User;

type Executar = (
  entrada: unknown,
  opcoes: { toolCallId: string; messages: never[] },
) => Promise<unknown>;

async function chamar<T = Record<string, unknown>>(
  org: Organization,
  usuario: User,
  nome: string,
  entrada: unknown,
): Promise<T> {
  const tools = construirToolsDoApp({
    organizationId: org.id,
    userId: usuario.id,
    sessaoId: `sessao-${org.id}`,
    tabelaPrecos: lerTabelaDePrecos(undefined),
    falaDoVisitante: "",
  });
  const ferramenta = tools[nome];
  if (!ferramenta?.execute) throw new Error(`tool ${nome} sem execute`);
  return (ferramenta.execute as unknown as Executar)(entrada, {
    toolCallId: "chamada",
    messages: [],
  }) as Promise<T>;
}

async function produtoEmPromocao(org: Organization, dono: User, nome: string) {
  return prisma.product.create({
    data: {
      organizationId: org.id,
      createdById: dono.id,
      name: nome,
      slug: nome.toLowerCase().replace(/\s+/g, "-"),
      salePrice: 100,
      promotionalPrice: 70,
      currentStock: 10,
      thumbnail: "/exemplo/produto-2.jpg",
    },
  });
}

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org que age");
  orgB = await createOrg("Org vizinha");
  donoA = await createUser();
  membroSimples = await createUser();
  await createMember(donoA, orgA);
  await prisma.member.create({
    data: {
      organizationId: orgA.id,
      userId: membroSimples.id,
      role: "member",
      permissions: [],
    },
  });
  // A organização precisa de saldo para as ações cobradas.
  await prisma.organization.update({
    where: { id: orgA.id },
    data: { starsBalance: 100, verifiedAt: new Date() },
  });

  await produtoEmPromocao(orgA, donoA, "Cafe da A");
  await produtoEmPromocao(orgB, donoA, "Cafe da B");
});

afterAll(resetDb);

describe("criarCatalogoPromocional", () => {
  it("cria na organização da closure, só com produtos dela, e cobra 5 ★", async () => {
    const antes = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });

    const resultado = await chamar<{
      catalogo: { id: string; produtos: number };
      link: { href: string };
    }>(orgA, donoA, "criarCatalogoPromocional", {
      nome: "Ofertas de teste",
      apenasPromocoes: true,
      ordenacao: "discount-desc",
      limite: 20,
    });

    expect(resultado.catalogo.produtos).toBe(1);
    expect(resultado.link.href).toContain("/catalogo-promocional/");

    const catalogo = await prisma.promotionalCatalog.findUniqueOrThrow({
      where: { id: resultado.catalogo.id },
      select: { organizationId: true, createdById: true, config: true },
    });
    expect(catalogo.organizationId).toBe(orgA.id);
    expect(catalogo.createdById).toBe(donoA.id);

    // O produto da outra organização não entra na seleção.
    const daB = await prisma.product.findFirstOrThrow({
      where: { organizationId: orgB.id },
      select: { id: true },
    });
    const config = catalogo.config as { manuallyAddedIds: string[] };
    expect(config.manuallyAddedIds).not.toContain(daB.id);

    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });
    expect(
      emEstrelas(antes.starsBalance) - emEstrelas(depois.starsBalance),
    ).toBe(5);

    const auditoria = await prisma.astroAcao.findFirstOrThrow({
      where: { organizationId: orgA.id, tool: "criarCatalogoPromocional" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditoria.userId).toBe(donoA.id);
    expect(emEstrelas(auditoria.starsCobradas)).toBe(5);
    expect(auditoria.erro).toBeNull();
  });

  it("membro sem permissão de editar é recusado, sem cobrar e com rastro", async () => {
    const antes = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });

    const resultado = await chamar<{ erro?: string }>(
      orgA,
      membroSimples,
      "criarCatalogoPromocional",
      {
        nome: "Não deveria existir",
        apenasPromocoes: true,
        ordenacao: "discount-desc",
        limite: 20,
      },
    );
    expect(resultado.erro).toMatch(/permissão/i);

    expect(
      await prisma.promotionalCatalog.count({
        where: { organizationId: orgA.id, name: "Não deveria existir" },
      }),
    ).toBe(0);

    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });
    expect(emEstrelas(depois.starsBalance)).toBe(
      emEstrelas(antes.starsBalance),
    );

    const auditoria = await prisma.astroAcao.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: membroSimples.id },
      orderBy: { createdAt: "desc" },
    });
    expect(auditoria.erro).toMatch(/permissão/i);
    expect(emEstrelas(auditoria.starsCobradas)).toBe(0);
  });

  it("critério que não casa com nada não cria catálogo vazio", async () => {
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "criarCatalogoPromocional",
      {
        nome: "Vazio",
        categorias: ["categoria que não existe"],
        apenasPromocoes: true,
        ordenacao: "discount-desc",
        limite: 20,
      },
    );
    expect(resultado.erro).toMatch(/categoria/i);
    expect(
      await prisma.promotionalCatalog.count({
        where: { organizationId: orgA.id, name: "Vazio" },
      }),
    ).toBe(0);
  });
});

describe("criarEventoNoCalendario", () => {
  it("cria com o membro como autor e devolve o link da tela", async () => {
    const resultado = await chamar<{
      evento: { titulo: string };
      link: { href: string };
      erro?: string;
    }>(orgA, donoA, "criarEventoNoCalendario", {
      titulo: "Degustação na loja",
      inicio: "2026-10-01T12:00:00.000Z",
      tipo: "ACAO_PDV",
      diaInteiro: false,
    });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.link.href).toBe("/trade/calendario");

    const evento = await prisma.calendarEvent.findFirstOrThrow({
      where: { organizationId: orgA.id, title: "Degustação na loja" },
      select: { endsAt: true, startsAt: true },
    });
    // Sem fim informado, duas horas.
    expect(evento.endsAt.getTime() - evento.startsAt.getTime()).toBe(
      2 * 60 * 60 * 1000,
    );
  });

  it("data que não é data vira erro legível, não exceção", async () => {
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "criarEventoNoCalendario",
      {
        titulo: "Quando?",
        inicio: "semana que vem",
        tipo: "REUNIAO",
        diaInteiro: false,
      },
    );
    expect(resultado.erro).toMatch(/data/i);
  });
});

describe("campanha de WhatsApp", () => {
  it("sem funil, explica em vez de criar campanha vazia", async () => {
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "criarCampanhaWhatsapp",
      { nome: "Promoção", limite: 500 },
    );
    expect(resultado.erro).toMatch(/funil/i);
    expect(
      await prisma.broadcast.count({ where: { organizationId: orgA.id } }),
    ).toBe(0);
  });

  it("organização de teste não monta campanha", async () => {
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { verifiedAt: null },
    });
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "criarCampanhaWhatsapp",
      { nome: "Promoção", limite: 500 },
    );
    expect(resultado.erro).toMatch(/empresa de teste/i);
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { verifiedAt: new Date() },
    });
  });

  it("disparar campanha inexistente não estoura, e não dispara nada", async () => {
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "enviarCampanhaWhatsapp",
      {
        campanha: "não existe",
        template: "oferta",
        idioma: "pt_BR",
        categoria: "MARKETING",
      },
    );
    expect(resultado.erro).toMatch(/Nenhuma campanha/i);
  });
});

describe("adicionarImagemAoProduto", () => {
  it("produto inexistente devolve erro e não escreve nada", async () => {
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "adicionarImagemAoProduto",
      {
        produto: "zzzz",
        url: "https://exemplo.test/foto.png",
        virarCapa: true,
      },
    );
    expect(resultado.erro).toMatch(/Nenhum produto/i);
  });

  it("não alcança produto de outra organização", async () => {
    const resultado = await chamar<{ erro?: string }>(
      orgA,
      donoA,
      "adicionarImagemAoProduto",
      {
        produto: "Cafe da B",
        url: "https://exemplo.test/foto.png",
        virarCapa: true,
      },
    );
    expect(resultado.erro).toMatch(/Nenhum produto/i);
  });
});
