import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { listLeads } from "@/app/router/crm/list-leads";
import { listStages } from "@/app/router/crm/list-stages";
import { moveLead } from "@/app/router/crm/move-lead";
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
 * Board do funil — ordenação fracionária.
 *
 * O que estes testes protegem é o modo de falha conhecido deste padrão:
 * dividir ao meio no mesmo ponto muitas vezes esgota a precisão da coluna, a
 * média entre dois vizinhos passa a ser igual a um deles, e o board começa a
 * embaralhar sozinho. Aqui isso é forçado de propósito.
 */

let org: Organization;
let outraOrg: Organization;
let admin: User;
let adminDaOutra: User;
let funilA: string;
let funilB: string;
let etapaNovo: string;
let etapaProposta: string;
const cards: string[] = [];

async function criarCard(nome: string, telefone: string, stageId: string) {
  const lead = await prisma.crmLead.create({
    data: {
      organizationId: org.id,
      funnelId: funilA,
      stageId,
      name: nome,
      phone: telefone,
    },
    select: { id: true },
  });
  return lead.id;
}

async function ordemDe(leadId: string): Promise<number> {
  const lead = await prisma.crmLead.findUniqueOrThrow({
    where: { id: leadId },
    select: { order: true },
  });
  return Number(lead.order);
}

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede do board");
  outraOrg = await createOrg("Rede vizinha");
  admin = await createUser();
  adminDaOutra = await createUser();
  await createMember(admin, org);
  await createMember(adminDaOutra, outraOrg);

  funilA = (
    await call(
      createFunnel,
      { name: "Vendas" },
      { context: s2sContext(admin, org) },
    )
  ).id;
  funilB = (
    await call(
      createFunnel,
      { name: "Outro" },
      { context: s2sContext(admin, org) },
    )
  ).id;

  const { etapas } = await call(
    listStages,
    { funnelId: funilA },
    { context: s2sContext(admin, org) },
  );
  etapaNovo = etapas[0]?.id as string;
  etapaProposta = etapas[2]?.id as string;

  // Três cards espaçados de mil em mil, como o board cria.
  for (let i = 0; i < 3; i += 1) {
    const id = await criarCard(`Card ${i + 1}`, `55869000000${i}`, etapaNovo);
    await prisma.crmLead.update({
      where: { id },
      data: { order: 1000 * (i + 1) },
    });
    cards.push(id);
  }
});

afterAll(resetDb);

describe("crm.lead.move — dentro da mesma coluna", () => {
  it("solta entre dois vizinhos com a média das posições", async () => {
    const [primeiro, segundo, terceiro] = cards as [string, string, string];

    const resultado = await call(
      moveLead,
      {
        leadId: terceiro,
        stageId: etapaNovo,
        anteriorId: primeiro,
        proximoId: segundo,
      },
      { context: s2sContext(admin, org) },
    );

    // Entre 1000 e 2000 → 1500. Uma escrita, não três.
    expect(resultado.ordem).toBe(1500);
    expect(await ordemDe(primeiro)).toBe(1000);
    expect(await ordemDe(segundo)).toBe(2000);
  });

  it("solta no topo posicionando antes do primeiro", async () => {
    const [primeiro, , terceiro] = cards as [string, string, string];
    const resultado = await call(
      moveLead,
      { leadId: terceiro, stageId: etapaNovo, proximoId: primeiro },
      { context: s2sContext(admin, org) },
    );
    expect(resultado.ordem).toBeLessThan(await ordemDe(primeiro));
  });

  it("solta no fim posicionando depois do último", async () => {
    const [primeiro, segundo, terceiro] = cards as [string, string, string];
    const resultado = await call(
      moveLead,
      { leadId: terceiro, stageId: etapaNovo, anteriorId: segundo },
      { context: s2sContext(admin, org) },
    );
    expect(resultado.ordem).toBeGreaterThan(await ordemDe(segundo));
    expect(await ordemDe(primeiro)).toBe(1000);
  });
});

describe("crm.lead.move — esgotamento da precisão", () => {
  it("renumera a coluna quando não cabe mais nada entre os vizinhos", async () => {
    const [primeiro, segundo, terceiro] = cards as [string, string, string];

    // Encosta os dois vizinhos até não haver folga representável entre eles.
    await prisma.crmLead.update({
      where: { id: primeiro },
      data: { order: "1000.0000000" },
    });
    await prisma.crmLead.update({
      where: { id: segundo },
      data: { order: "1000.0000001" },
    });

    const resultado = await call(
      moveLead,
      {
        leadId: terceiro,
        stageId: etapaNovo,
        anteriorId: primeiro,
        proximoId: segundo,
      },
      { context: s2sContext(admin, org) },
    );

    expect(resultado.renumerou).toBe(true);

    // Depois de redistribuir, o card cabe entre os dois — e cada um tem uma
    // posição distinta, que é o que impede a ordem de depender do desempate
    // do banco.
    const ordens = await prisma.crmLead.findMany({
      where: { stageId: etapaNovo, organizationId: org.id },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });
    const valores = ordens.map((linha) => Number(linha.order));
    expect(new Set(valores).size).toBe(valores.length);
    expect(valores).toEqual([...valores].sort((a, b) => a - b));
  });
});

describe("crm.lead.move — entre colunas", () => {
  it("muda de etapa e grava histórico", async () => {
    const alvo = cards[0] as string;

    await call(
      moveLead,
      { leadId: alvo, stageId: etapaProposta },
      { context: s2sContext(admin, org) },
    );

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: alvo },
    });
    expect(lead.stageId).toBe(etapaProposta);
    expect(lead.stageEnteredAt).not.toBeNull();

    const historico = await prisma.crmLeadHistory.count({
      where: { leadId: alvo, eventType: "STATUS_CHANGE" },
    });
    expect(historico).toBe(1);
  });

  it("reordenar dentro da mesma coluna NÃO grava histórico", async () => {
    // Arrastar para organizar não é evento de funil; gravar viraria ruído na
    // jornada do cliente.
    const alvo = cards[1] as string;
    const antes = await prisma.crmLeadHistory.count({
      where: { leadId: alvo },
    });

    await call(
      moveLead,
      { leadId: alvo, stageId: etapaNovo, anteriorId: cards[2] },
      { context: s2sContext(admin, org) },
    );

    expect(await prisma.crmLeadHistory.count({ where: { leadId: alvo } })).toBe(
      antes,
    );
  });

  it("recusa etapa de outro funil", async () => {
    const { etapas } = await call(
      listStages,
      { funnelId: funilB },
      { context: s2sContext(admin, org) },
    );
    await expect(
      call(
        moveLead,
        { leadId: cards[1] as string, stageId: etapas[0]?.id as string },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/etapa não encontrada/i);
  });

  it("recusa card de outra organização", async () => {
    await expect(
      call(
        moveLead,
        { leadId: cards[0] as string, stageId: etapaProposta },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("crm.lead.list", () => {
  it("agrupa por etapa, na ordem do board, com soma por coluna", async () => {
    await prisma.crmLead.update({
      where: { id: cards[0] as string },
      data: { amount: 500 },
    });

    const { colunas } = await call(
      listLeads,
      { funnelId: funilA, porEtapa: 50 },
      { context: s2sContext(admin, org) },
    );

    expect(colunas.map((coluna) => coluna.nome)).toEqual([
      "Novo",
      "Em atendimento",
      "Proposta",
      "Ganho",
      "Perdido",
    ]);

    const proposta = colunas.find((coluna) => coluna.nome === "Proposta");
    expect(proposta?.valorTotal).toBe(500);

    const novo = colunas.find((coluna) => coluna.nome === "Novo");
    const ordens = novo?.cards.map((card) => card.ordem) ?? [];
    expect(ordens).toEqual([...ordens].sort((a, b) => a - b));
  });

  it("recusa funil de outra organização", async () => {
    await expect(
      call(
        listLeads,
        { funnelId: funilA, porEtapa: 50 },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});
