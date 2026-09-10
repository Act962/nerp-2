import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, resetDb } from "./helpers";

/**
 * Gerar imagem: o prefixo, a cota e a conta.
 *
 * O provedor é dublado — o que se verifica é o que o nerp faz em volta dele:
 * a imagem nasce dentro do prefixo da organização, a cota diária segura o
 * gasto, e as ★ saem só quando a imagem saiu.
 */

const gerarEGuardarImagem = vi.hoisted(() => vi.fn());
vi.mock("@/features/astro/server/gerar-imagem", async (original) => {
  const modulo =
    await original<typeof import("@/features/astro/server/gerar-imagem")>();
  return { ...modulo, gerarEGuardarImagem };
});

const { construirToolsDoApp } = await import(
  "@/features/astro/server/tools-app"
);
const { lerTabelaDePrecos } = await import(
  "@/features/astro-consultor/server/preco"
);
const { COTA_DIARIA_DE_IMAGENS } = await import(
  "@/features/astro/server/gerar-imagem"
);

let orgA: Organization;
let dono: User;

type Executar = (
  entrada: unknown,
  opcoes: { toolCallId: string; messages: never[] },
) => Promise<unknown>;

/** O modelo que finge ser o Google — o suficiente para a tool existir. */
function modeloGoogle() {
  return {
    modelo: "modelo" as never,
    nome: "gemini-2.5-flash",
    provedor: "google" as const,
    google: {
      tools: { googleSearch: () => ({}), urlContext: () => ({}) },
    } as never,
  };
}

async function chamar<T>(
  nome: string,
  entrada: unknown,
  modelo: ReturnType<typeof modeloGoogle> | undefined = modeloGoogle(),
): Promise<T> {
  const tools = construirToolsDoApp({
    organizationId: orgA.id,
    userId: dono.id,
    sessaoId: `sessao-${orgA.id}`,
    tabelaPrecos: lerTabelaDePrecos(undefined),
    falaDoVisitante: "",
    modelo,
  });
  const ferramenta = tools[nome];
  if (!ferramenta?.execute) throw new Error(`tool ${nome} sem execute`);
  return (ferramenta.execute as unknown as Executar)(entrada, {
    toolCallId: "chamada",
    messages: [],
  }) as Promise<T>;
}

function toolsDoApp(modelo?: ReturnType<typeof modeloGoogle>) {
  return construirToolsDoApp({
    organizationId: orgA.id,
    userId: dono.id,
    sessaoId: "sessao",
    tabelaPrecos: lerTabelaDePrecos(undefined),
    falaDoVisitante: "",
    modelo,
  });
}

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org que gera imagem");
  dono = await createUser();
  await createMember(dono, orgA);
  await prisma.organization.update({
    where: { id: orgA.id },
    data: { starsBalance: 100, verifiedAt: new Date() },
  });
});

afterAll(resetDb);

describe("gerarImagem", () => {
  it("guarda no prefixo da organização, debita 5 ★ e deixa rastro", async () => {
    gerarEGuardarImagem.mockImplementation(
      async (entrada: { organizationId: string }) => ({
        chave: `${entrada.organizationId}/astro/imagem.png`,
        url: `https://assets.test/${entrada.organizationId}/astro/imagem.png`,
        mediaType: "image/png",
      }),
    );

    const antes = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });

    const resultado = await chamar<{
      imagem: { url: string; chave: string };
      erro?: string;
    }>("gerarImagem", {
      descricao: "Uma xícara de café sobre madeira, luz da manhã",
      finalidade: "fundo_de_catalogo",
      proporcao: "1:1",
    });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.imagem.chave.startsWith(`${orgA.id}/astro/`)).toBe(true);

    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });
    expect(antes.starsBalance - depois.starsBalance).toBe(5);

    const auditoria = await prisma.astroAcao.findFirstOrThrow({
      where: { organizationId: orgA.id, tool: "gerarImagem" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditoria.starsCobradas).toBe(5);
    expect(auditoria.erro).toBeNull();
  });

  it("falha do provedor não cobra, e o erro fica gravado", async () => {
    gerarEGuardarImagem.mockRejectedValueOnce(new Error("provedor fora do ar"));

    const antes = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });

    const resultado = await chamar<{ erro?: string }>("gerarImagem", {
      descricao: "Qualquer coisa que não vai sair",
      finalidade: "outro",
      proporcao: "1:1",
    });

    expect(resultado.erro).toMatch(/provedor fora do ar/);
    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });
    expect(depois.starsBalance).toBe(antes.starsBalance);
  });

  it("estourada a cota do dia, recusa sem chamar o provedor", async () => {
    // As linhas de hoje são o contador: preenche até o teto.
    const jaGravadas = await prisma.astroAcao.count({
      where: { organizationId: orgA.id, tool: "gerarImagem", erro: null },
    });
    await prisma.astroAcao.createMany({
      data: Array.from({ length: COTA_DIARIA_DE_IMAGENS - jaGravadas }, () => ({
        organizationId: orgA.id,
        userId: dono.id,
        sessionId: "sessao",
        tool: "gerarImagem",
        entrada: {},
        starsCobradas: 0,
      })),
    });

    gerarEGuardarImagem.mockClear();
    const resultado = await chamar<{ erro?: string }>("gerarImagem", {
      descricao: "Mais uma, que não deveria sair",
      finalidade: "outro",
      proporcao: "1:1",
    });

    expect(resultado.erro).toMatch(/limite/i);
    expect(gerarEGuardarImagem).not.toHaveBeenCalled();
  });
});

describe("quem atende decide o que existe", () => {
  it("sem provedor Google, nem gerarImagem nem busca na web entram", () => {
    const tools = toolsDoApp(undefined);
    expect(tools.gerarImagem).toBeUndefined();
    expect(tools.google_search).toBeUndefined();
    expect(tools.url_context).toBeUndefined();
  });

  it("com o Google, as três aparecem", () => {
    const tools = toolsDoApp(modeloGoogle());
    expect(tools.gerarImagem).toBeDefined();
    expect(tools.google_search).toBeDefined();
    expect(tools.url_context).toBeDefined();
  });
});
