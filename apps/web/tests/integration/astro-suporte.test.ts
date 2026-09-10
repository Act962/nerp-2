import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conferirTetoDiario } from "@/features/astro/server/teto-diario";
import { construirToolsDoApp } from "@/features/astro/server/tools-app";
import { lerTabelaDePrecos } from "@/features/astro-consultor/server/preco";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createMember, createOrg, createUser, resetDb } from "./helpers";

/**
 * A saída para gente, e a última trava da fatura.
 *
 * O chamado é um `SiteLead` GLOBAL — as tabelas `site_*` não têm
 * `organizationId`, porque o site é um só. Quem é a empresa entra no briefing,
 * e é isso que se verifica aqui: o time recebe contexto suficiente para já
 * chegar sabendo, sem o lead virar tabela por inquilino.
 */

let orgA: Organization;
let orgB: Organization;
let donoA: User;
let donoB: User;

const AGORA = new Date("2026-09-20T15:00:00.000Z");

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

/** Sessões do canal do app, para a soma do teto diário ter o que contar. */
async function sessaoComMensagens(
  org: Organization,
  usuario: User,
  mensagens: number,
  criadaEm: Date,
) {
  return prisma.siteChatSession.create({
    data: {
      channel: "APP",
      organizationId: org.id,
      userId: usuario.id,
      messageCount: mensagens,
      createdAt: criadaEm,
      expiresAt: new Date(criadaEm.getTime() + 24 * 60 * 60 * 1000),
    },
  });
}

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org que pede ajuda");
  orgB = await createOrg("Org vizinha");
  donoA = await createUser();
  donoB = await createUser();
  await createMember(donoA, orgA);
  await createMember(donoB, orgB);
  await prisma.organization.update({
    where: { id: orgA.id },
    data: { starsBalance: 100, verifiedAt: new Date() },
  });
});

afterAll(resetDb);

describe("contatarSuporte", () => {
  it("abre o chamado com o contexto da organização no briefing", async () => {
    const resultado = await chamarTool<{
      chamado: { id: string; assunto: string };
      formulario: { url: string; rotulo: string };
      erro?: string;
    }>(orgA, donoA, "contatarSuporte", {
      assunto: "Impressora do PDV não imprime o cupom",
      resumo:
        "Trocamos o cabo e reiniciamos o terminal. A venda fecha, mas o cupom não sai.",
    });

    expect(resultado.erro).toBeUndefined();
    expect(resultado.formulario.url).toContain("wa.me/");
    // O botão leva a mensagem escrita; o modelo não digita endereço.
    expect(resultado.formulario.url).toContain("text=");

    const lead = await prisma.siteLead.findUniqueOrThrow({
      where: { id: resultado.chamado.id },
    });
    expect(lead.company).toBe(orgA.name);
    expect(lead.email).toBe(donoA.email);

    const briefing = lead.briefing as {
      organizationId: string;
      assunto: string;
      contaDeTeste: boolean;
      plano: string;
      stars: { saldo: number };
    };
    expect(briefing.organizationId).toBe(orgA.id);
    expect(briefing.assunto).toContain("Impressora");
    expect(briefing.contaDeTeste).toBe(false);
    expect(briefing.plano).toBeTruthy();
    expect(briefing.stars.saldo).toBe(100);
  });

  it("o mesmo assunto de novo atualiza o chamado, não cria um segundo", async () => {
    const entrada = {
      assunto: "Impressora do PDV não imprime o cupom",
      resumo: "Voltou a acontecer hoje de manhã, no terminal 2.",
    };
    const resultado = await chamarTool<{ chamado: { id: string } }>(
      orgA,
      donoA,
      "contatarSuporte",
      entrada,
    );

    const leads = await prisma.siteLead.findMany({
      where: { email: donoA.email },
      select: { id: true, briefing: true },
    });
    expect(leads).toHaveLength(1);
    expect(leads[0].id).toBe(resultado.chamado.id);
    expect(JSON.stringify(leads[0].briefing)).toContain("terminal 2");
  });

  it("a conta de teste vai marcada — o time sabe antes de responder", async () => {
    await prisma.organization.update({
      where: { id: orgB.id },
      data: { verifiedAt: null },
    });

    const resultado = await chamarTool<{ chamado: { id: string } }>(
      orgB,
      donoB,
      "contatarSuporte",
      {
        assunto: "Como conecto o WhatsApp?",
        resumo: "Não achei onde ligar o número na tela de campanhas.",
      },
    );

    const lead = await prisma.siteLead.findUniqueOrThrow({
      where: { id: resultado.chamado.id },
    });
    const briefing = lead.briefing as {
      contaDeTeste: boolean;
      organizationId: string;
    };
    expect(briefing.contaDeTeste).toBe(true);
    expect(briefing.organizationId).toBe(orgB.id);
  });

  it("a ação fica no rastro do Astro, como toda escrita", async () => {
    const auditoria = await prisma.astroAcao.findFirstOrThrow({
      where: { organizationId: orgA.id, tool: "contatarSuporte" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditoria.userId).toBe(donoA.id);
    expect(auditoria.erro).toBeNull();
    // Abrir chamado não custa ★: quem precisa de ajuda não paga para pedir.
    expect(auditoria.starsCobradas).toBe(0);
  });
});

describe("conferirTetoDiario", () => {
  it("teto zero não limita nada — é o padrão de quem não configurou", async () => {
    await sessaoComMensagens(orgA, donoA, 5_000, AGORA);
    expect(await conferirTetoDiario(orgA.id, 0, AGORA)).toEqual({ ok: true });
  });

  it("soma as mensagens de TODAS as sessões do dia, não de uma só", async () => {
    await resetDb();
    orgA = await createOrg("Org que fala muito");
    donoA = await createUser();
    await createMember(donoA, orgA);

    await sessaoComMensagens(orgA, donoA, 30, AGORA);
    await sessaoComMensagens(orgA, donoA, 30, AGORA);

    // Sessenta mensagens em duas conversas: o limite por sessão não veria
    // isto, e é exatamente o caso que este teto existe para pegar.
    const veredito = await conferirTetoDiario(orgA.id, 50, AGORA);
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) {
      expect(veredito.usadas).toBe(60);
      expect(veredito.teto).toBe(50);
    }
  });

  it("o que passou de 24 horas não conta mais", async () => {
    const ontem = new Date(AGORA.getTime() - 30 * 60 * 60 * 1000);
    await resetDb();
    orgA = await createOrg("Org de ontem");
    donoA = await createUser();
    await createMember(donoA, orgA);
    await sessaoComMensagens(orgA, donoA, 100, ontem);

    expect(await conferirTetoDiario(orgA.id, 50, AGORA)).toEqual({ ok: true });
  });

  it("a conversa da vizinha não conta contra o teto desta", async () => {
    await resetDb();
    orgA = await createOrg("Org A");
    orgB = await createOrg("Org B");
    donoA = await createUser();
    donoB = await createUser();
    await createMember(donoA, orgA);
    await createMember(donoB, orgB);

    await sessaoComMensagens(orgB, donoB, 500, AGORA);

    expect(await conferirTetoDiario(orgA.id, 50, AGORA)).toEqual({ ok: true });
    expect((await conferirTetoDiario(orgB.id, 50, AGORA)).ok).toBe(false);
  });
});
