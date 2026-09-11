import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listarAvisos } from "@/app/router/astro/listar-avisos";
import { marcarLido } from "@/app/router/astro/marcar";
import { avaliarAvisosDaOrg } from "@/features/astro/server/avisos/avaliar-org";
import {
  avaliarEGravar,
  gravarAvisos,
} from "@/features/astro/server/avisos/gravar";
import { construirToolsDoApp } from "@/features/astro/server/tools-app";
import { lerTabelaDePrecos } from "@/features/astro-consultor/server/preco";
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
 * Avisos e memória: o que o Astro diz sozinho, e o que ele guarda.
 *
 * As duas coisas são por organização, e é isso que se garante aqui. Um aviso
 * da vizinha não aparece na lista, e não se marca como lido pelo id — o id
 * vem do cliente, e sem a revalidação um palpite alcançaria a linha dela.
 */

let orgA: Organization;
let orgB: Organization;
let donoA: User;
let donoB: User;

const AGORA = new Date("2026-09-15T12:00:00.000Z");

type Executar = (
  entrada: unknown,
  opcoes: { toolCallId: string; messages: never[] },
) => Promise<unknown>;

async function chamarTool<T>(
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

/** Um produto abaixo do mínimo, que é o gatilho mais simples de aviso. */
async function produtoFaltando(org: Organization, dono: User, nome: string) {
  return prisma.product.create({
    data: {
      organizationId: org.id,
      createdById: dono.id,
      name: nome,
      slug: `${nome.toLowerCase().replace(/\s+/g, "-")}-${org.id.slice(-4)}`,
      salePrice: 10,
      isActive: true,
      trackStock: true,
      currentStock: 1,
      minStock: 20,
    },
  });
}

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org com avisos");
  orgB = await createOrg("Org vizinha");
  donoA = await createUser();
  donoB = await createUser();
  await createMember(donoA, orgA);
  await createMember(donoB, orgB);
  await prisma.organization.update({
    where: { id: orgA.id },
    data: { starsBalance: 100, verifiedAt: new Date() },
  });
  await prisma.organization.update({
    where: { id: orgB.id },
    data: { starsBalance: 100, verifiedAt: new Date() },
  });

  await produtoFaltando(orgA, donoA, "Cafe da A");
  await produtoFaltando(orgB, donoB, "Cafe da B");
});

afterAll(resetDb);

describe("avaliarAvisosDaOrg", () => {
  it("vê o estoque da própria organização, e só o dela", async () => {
    const candidatos = await avaliarAvisosDaOrg(orgA.id, AGORA);
    const estoque = candidatos.find((c) => c.tipo === "estoque_baixo");

    expect(estoque).toBeDefined();
    expect(estoque?.corpo).toContain("Cafe da A");
    expect(estoque?.corpo).not.toContain("Cafe da B");
    // Um produto abaixo do mínimo é atenção, não urgência.
    expect(estoque?.severidade).toBe("media");
  });

  it("a chave de deduplicação carrega o dia", async () => {
    const candidatos = await avaliarAvisosDaOrg(orgA.id, AGORA);
    const estoque = candidatos.find((c) => c.tipo === "estoque_baixo");
    expect(estoque?.dedupeKey).toContain("2026-09-15");
  });
});

describe("gravarAvisos", () => {
  it("rodar duas vezes no mesmo dia não duplica o aviso", async () => {
    const primeira = await avaliarEGravar(orgA.id, AGORA);
    const segunda = await avaliarEGravar(orgA.id, AGORA);

    expect(primeira).toBeGreaterThan(0);
    expect(segunda).toBe(0);

    const total = await prisma.astroAviso.count({
      where: { organizationId: orgA.id, tipo: "estoque_baixo" },
    });
    expect(total).toBe(1);
  });

  it("no dia seguinte, o mesmo problema vira aviso novo", async () => {
    const amanha = new Date(AGORA.getTime() + 24 * 60 * 60 * 1000);
    const criados = await avaliarEGravar(orgA.id, amanha);
    expect(criados).toBeGreaterThan(0);
  });
});

describe("listarAvisos", () => {
  it("a organização A não enxerga o aviso da B", async () => {
    await gravarAvisos(orgB.id, [
      {
        tipo: "estoque_baixo",
        severidade: "alta",
        titulo: "Segredo da vizinha",
        corpo: "Isto é da org B.",
        dedupeKey: "estoque_baixo:segredo:2026-09-15",
      },
    ]);

    const resposta = await call(
      listarAvisos,
      { apenasNaoLidos: false, limite: 50 },
      { context: s2sContext(donoA, orgA) },
    );

    expect(resposta.avisos.length).toBeGreaterThan(0);
    for (const aviso of resposta.avisos) {
      expect(aviso.titulo).not.toContain("Segredo da vizinha");
    }
    expect(resposta.naoLidos).toBe(resposta.avisos.length);
  });
});

describe("marcarLido", () => {
  it("aviso da B, marcado pela A, não é encontrado", async () => {
    const daB = await prisma.astroAviso.findFirstOrThrow({
      where: { organizationId: orgB.id },
      select: { id: true },
    });

    await expect(
      call(marcarLido, { id: daB.id }, { context: s2sContext(donoA, orgA) }),
    ).rejects.toThrow();

    const depois = await prisma.astroAviso.findUniqueOrThrow({
      where: { id: daB.id },
      select: { lidoEm: true },
    });
    expect(depois.lidoEm).toBeNull();
  });

  it("aviso da própria organização é marcado", async () => {
    const daA = await prisma.astroAviso.findFirstOrThrow({
      where: { organizationId: orgA.id, lidoEm: null },
      select: { id: true },
    });

    const resposta = await call(
      marcarLido,
      { id: daA.id },
      { context: s2sContext(donoA, orgA) },
    );
    expect(resposta.ok).toBe(true);

    const depois = await prisma.astroAviso.findUniqueOrThrow({
      where: { id: daA.id },
      select: { lidoEm: true },
    });
    expect(depois.lidoEm).not.toBeNull();
  });
});

describe("memória", () => {
  it("lembrar grava na organização de quem falou", async () => {
    const resultado = await chamarTool<{ chave: string; erro?: string }>(
      orgA,
      donoA,
      "lembrar",
      { chave: "Reposicao", fato: "A reposição é sempre na terça." },
    );
    expect(resultado.erro).toBeUndefined();
    // A chave é normalizada: "Reposicao" e "reposicao" são o mesmo assunto.
    expect(resultado.chave).toBe("reposicao");

    const memoria = await prisma.astroMemoria.findFirstOrThrow({
      where: { organizationId: orgA.id, chave: "reposicao" },
    });
    expect(memoria.texto).toContain("terça");
    expect(memoria.origem).toBe("pessoa");
  });

  it("lembrar de novo com a mesma chave atualiza, não duplica", async () => {
    await chamarTool(orgA, donoA, "lembrar", {
      chave: "reposicao",
      fato: "A reposição passou para a quinta.",
    });

    const linhas = await prisma.astroMemoria.findMany({
      where: { organizationId: orgA.id, chave: "reposicao" },
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].texto).toContain("quinta");
  });

  it("a memória da A não aparece para a B", async () => {
    const daB = await chamarTool<{ memorias: { chave: string }[] }>(
      orgB,
      donoB,
      "oQueVoceLembra",
      {},
    );
    expect(daB.memorias.some((m) => m.chave === "reposicao")).toBe(false);

    const daA = await chamarTool<{ memorias: { chave: string }[] }>(
      orgA,
      donoA,
      "oQueVoceLembra",
      {},
    );
    expect(daA.memorias.some((m) => m.chave === "reposicao")).toBe(true);
  });

  it("esquecer o que não existe explica, em vez de fingir que apagou", async () => {
    const resultado = await chamarTool<{ erro?: string }>(
      orgA,
      donoA,
      "esquecer",
      { chave: "nunca-guardado" },
    );
    expect(resultado.erro).toMatch(/não guardei/i);
  });

  it("esquecer apaga só a chave pedida, e só da própria organização", async () => {
    await chamarTool(orgB, donoB, "lembrar", {
      chave: "reposicao",
      fato: "Na org B a reposição é no sábado.",
    });

    await chamarTool(orgA, donoA, "esquecer", { chave: "reposicao" });

    expect(
      await prisma.astroMemoria.count({
        where: { organizationId: orgA.id, chave: "reposicao" },
      }),
    ).toBe(0);
    // A da vizinha continua de pé.
    expect(
      await prisma.astroMemoria.count({
        where: { organizationId: orgB.id, chave: "reposicao" },
      }),
    ).toBe(1);
  });
});
