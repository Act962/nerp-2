import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * O Astro dentro do nerp: as tools nunca saem da organização, a cobrança por
 * token clampa ao saldo, e a rota barra quem não está logado ou não tem ★.
 *
 * O Better Auth é dublado: a rota só precisa saber "quem é" e "qual org".
 */

const sessaoDublada: {
  atual: { user: { id: string; name: string } } | null;
  org: { id: string; name: string } | null;
} = { atual: null, org: null };

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => sessaoDublada.atual),
      getFullOrganization: vi.fn(async () => sessaoDublada.org),
    },
  },
}));

const { POST } = await import("@/app/api/astro/chat/route");
const { construirToolsDoApp, inicioDoPeriodo } = await import(
  "@/features/astro/server/tools-app"
);
const { cobrarTokensDoAstro } = await import(
  "@/features/astro/server/cobranca"
);
const { creditar } = await import("@/features/stars/server/debitar");
const { lerTabelaDePrecos } = await import(
  "@/features/astro-consultor/server/preco"
);
const prisma = (await import("@/lib/db")).default;
const { createMember, createOrg, createUser, resetDb } = await import(
  "./helpers"
);

type Org = Awaited<ReturnType<typeof createOrg>>;
type Usuario = Awaited<ReturnType<typeof createUser>>;

let orgA: Org;
let orgB: Org;
let donoA: Usuario;

type Executar = (
  entrada: unknown,
  opcoes: { toolCallId: string; messages: never[] },
) => Promise<unknown>;

async function executar(
  tools: ReturnType<typeof construirToolsDoApp>,
  nome: string,
  entrada: unknown,
): Promise<unknown> {
  const ferramenta = tools[nome];
  if (!ferramenta?.execute) throw new Error(`tool ${nome} sem execute`);
  // O `execute` do AI SDK é uma união de assinaturas; aqui só interessa
  // chamá-lo como o modelo chamaria.
  return (ferramenta.execute as unknown as Executar)(entrada, {
    toolCallId: "chamada-1",
    messages: [],
  });
}

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org A do Astro");
  orgB = await createOrg("Org B do Astro");
  donoA = await createUser();
  await createMember(donoA, orgA);

  await prisma.product.createMany({
    data: [
      {
        organizationId: orgA.id,
        createdById: donoA.id,
        name: "Café da A",
        slug: "cafe-da-a",
        salePrice: 13.99,
      },
      {
        organizationId: orgB.id,
        createdById: donoA.id,
        name: "Café da B",
        slug: "cafe-da-b",
        salePrice: 9.99,
      },
    ],
  });
});

afterAll(resetDb);

describe("tools do app", () => {
  it("buscarProdutos nunca devolve produto de outra organização", async () => {
    const tools = construirToolsDoApp({
      organizationId: orgA.id,
      userId: donoA.id,
      sessaoId: "sessao-teste",
      tabelaPrecos: lerTabelaDePrecos(undefined),
      falaDoVisitante: "",
    });

    const resultado = (await executar(tools, "buscarProdutos", {
      termo: "Café",
    })) as { produtos: { nome: string }[] };

    expect(resultado.produtos.map((p) => p.nome)).toEqual(["Café da A"]);
  });

  it("minhaOperacao fala da organização da closure, com plano e Stars", async () => {
    await creditar({
      organizationId: orgA.id,
      valor: 50,
      tipo: "WELCOME_BONUS",
      descricao: "Boas-vindas",
    });
    const tools = construirToolsDoApp({
      organizationId: orgA.id,
      userId: donoA.id,
      sessaoId: "sessao-teste",
      tabelaPrecos: lerTabelaDePrecos(undefined),
      falaDoVisitante: "",
    });

    const resultado = (await executar(tools, "minhaOperacao", {})) as {
      organizacao: string;
      plano: { nome: string };
      stars: { saldo: number; limiteDoPlano: number };
      cadastros: { produtos: { reais: number } };
    };

    expect(resultado.organizacao).toBe(orgA.name);
    expect(resultado.plano.nome).toBe("Grátis");
    expect(resultado.stars.saldo).toBe(50);
    expect(resultado.stars.limiteDoPlano).toBe(50);
    expect(resultado.cadastros.produtos.reais).toBe(1);
  });

  it("nenhuma tool aceita organizationId como argumento", () => {
    const tools = construirToolsDoApp({
      organizationId: orgA.id,
      userId: donoA.id,
      sessaoId: "sessao-teste",
      tabelaPrecos: lerTabelaDePrecos(undefined),
      falaDoVisitante: "",
    });
    for (const [nome, ferramenta] of Object.entries(tools)) {
      const schema = JSON.stringify(ferramenta.inputSchema ?? {});
      expect(schema, nome).not.toMatch(/organizationId/i);
    }
  });

  it("inicioDoPeriodo respeita o fuso de Fortaleza (UTC-3)", () => {
    // 01:00 UTC de 10/09 ainda é 22:00 de 09/09 em Fortaleza.
    const agora = new Date("2026-09-10T01:00:00Z");
    expect(inicioDoPeriodo("hoje", agora).toISOString()).toBe(
      "2026-09-09T03:00:00.000Z",
    );
    expect(inicioDoPeriodo("mes", agora).toISOString()).toBe(
      "2026-09-01T03:00:00.000Z",
    );
  });
});

describe("cobrança por token", () => {
  it("cobra por bloco de mil e clampa ao saldo", async () => {
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { starsBalance: 2, starsUsedInCycle: 0 },
    });

    const resultado = await cobrarTokensDoAstro({
      organizationId: orgA.id,
      userId: donoA.id,
      tokensIn: 3_500,
      tokensOut: 400,
    });
    // 3.900 tokens = 4 blocos = 4 ★ pedidas; só havia 2.
    expect(resultado.cobrado).toBe(2);
    expect(resultado.parcial).toBe(true);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true, starsUsedInCycle: true },
    });
    expect(org.starsBalance).toBe(0);
    expect(org.starsUsedInCycle).toBe(2);
  });
});

describe("POST /api/astro/chat", () => {
  const corpo = JSON.stringify({
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: "oi" }] },
    ],
  });
  const requisicao = () =>
    new Request("http://localhost/api/astro/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: corpo,
    });

  it("sem sessão: 401", async () => {
    sessaoDublada.atual = null;
    sessaoDublada.org = null;
    const resposta = await POST(requisicao() as never);
    expect(resposta.status).toBe(401);
  });

  it("logado mas sem organização ativa: 403", async () => {
    sessaoDublada.atual = { user: { id: donoA.id, name: donoA.name } };
    sessaoDublada.org = null;
    const resposta = await POST(requisicao() as never);
    expect(resposta.status).toBe(403);
  });

  it("logado numa organização de que não é membro: 403", async () => {
    sessaoDublada.atual = { user: { id: donoA.id, name: donoA.name } };
    sessaoDublada.org = { id: orgB.id, name: orgB.name };
    const resposta = await POST(requisicao() as never);
    expect(resposta.status).toBe(403);
  });

  it("sem Stars: 402 com o saldo, antes de gastar token", async () => {
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { starsBalance: 0 },
    });
    // O Astro precisa estar ligado para chegar ao pré-check de saldo.
    await prisma.siteSetting.upsert({
      where: { key: "astro-config" },
      create: { key: "astro-config", value: { ativo: true } },
      update: { value: { ativo: true } },
    });

    sessaoDublada.atual = { user: { id: donoA.id, name: donoA.name } };
    sessaoDublada.org = { id: orgA.id, name: orgA.name };
    const resposta = await POST(requisicao() as never);
    // 402 quando há chave de modelo; 503 quando o ambiente de teste não tem
    // nenhuma. Nos dois casos, nada foi cobrado e nenhuma sessão nasceu.
    expect([402, 503]).toContain(resposta.status);
    if (resposta.status === 402) {
      const json = (await resposta.json()) as { erro: string; saldo: number };
      expect(json.erro).toBe("sem_saldo");
      expect(json.saldo).toBe(0);
    }
    const sessoes = await prisma.siteChatSession.count({
      where: { organizationId: orgA.id },
    });
    expect(sessoes).toBe(0);
  });
});
