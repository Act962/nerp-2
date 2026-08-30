import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { getLead } from "@/app/router/crm/get-lead";
import { listStages } from "@/app/router/crm/list-stages";
import { updateLead } from "@/app/router/crm/update-lead";
import { persistInboundMessage } from "@/features/whatsapp-chat/lib/inbound/persist-inbound-message";
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
 * Ficha do lead — o CRM que aparece ao lado da conversa.
 *
 * O teste mais importante aqui não é o isolamento entre organizações (esse já
 * é rotina), e sim o **estágio de outro funil**: `stageId` chega do cliente, e
 * aceitar como veio deixaria o card órfão de um board ou, pior, movido para o
 * funil de outro tenant.
 */

let org: Organization;
let outraOrg: Organization;
let admin: User;
let adminDaOutra: User;
let funilA: string;
let funilB: string;
let leadId: string;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede do CRM");
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
      { name: "Pós-venda" },
      { context: s2sContext(admin, org) },
    )
  ).id;

  const recebida = await persistInboundMessage(
    {
      type: "text",
      externalMessageId: "wamid.CRM-1",
      sentAt: new Date(),
      sender: { phone: "5586977776666", displayName: "Maria", fromMe: false },
      instance: { externalId: "1234567890" },
      body: "quero um orçamento",
    },
    { organizationId: org.id, funnelId: funilA },
  );
  if (!("leadId" in recebida)) throw new Error("setup falhou");
  leadId = recebida.leadId;
});

afterAll(resetDb);

describe("crm.lead.get", () => {
  it("devolve a ficha com etapa e valores como número", async () => {
    const lead = await call(
      getLead,
      { leadId },
      { context: s2sContext(admin, org) },
    );

    expect(lead.nome).toBe("Maria");
    expect(lead.estagio.nome).toBe("Novo");
    // `Decimal` do Prisma não atravessa a fronteira: sai número.
    expect(typeof lead.valor).toBe("number");
    expect(lead.cliente).toBeNull();
  });

  it("mostra as compras quando existe cliente vinculado", async () => {
    const cliente = await prisma.customer.create({
      data: { organizationId: org.id, name: "Maria Souza" },
    });
    await prisma.sale.createMany({
      data: [
        {
          organizationId: org.id,
          customerId: cliente.id,
          saleNumber: 9001,
          subtotal: 100,
          total: 100,
        },
        {
          organizationId: org.id,
          customerId: cliente.id,
          saleNumber: 9002,
          subtotal: 250,
          total: 250,
        },
      ],
    });
    await prisma.crmLead.update({
      where: { id: leadId },
      data: { customerId: cliente.id },
    });

    const lead = await call(
      getLead,
      { leadId },
      { context: s2sContext(admin, org) },
    );

    expect(lead.cliente?.totalDeCompras).toBe(2);
    expect(lead.cliente?.valorTotal).toBe(350);
    expect(lead.cliente?.ultimasCompras).toHaveLength(2);
  });

  it("recusa lead de outra organização", async () => {
    await expect(
      call(
        getLead,
        { leadId },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("crm.lead.update", () => {
  it("move de etapa e registra no histórico", async () => {
    const { etapas } = await call(
      listStages,
      { funnelId: funilA },
      { context: s2sContext(admin, org) },
    );
    const proposta = etapas.find((etapa) => etapa.nome === "Proposta");
    if (!proposta) throw new Error("etapa Proposta não existe");

    await call(
      updateLead,
      { leadId, estagioId: proposta.id },
      { context: s2sContext(admin, org) },
    );

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
    });
    expect(lead.stageId).toBe(proposta.id);
    // O cronômetro da etapa reinicia — é o que mede tempo parado em cada uma.
    expect(lead.stageEnteredAt).not.toBeNull();

    const historico = await prisma.crmLeadHistory.findFirst({
      where: { leadId, eventType: "STATUS_CHANGE" },
    });
    expect(historico?.newStageId).toBe(proposta.id);
  });

  it("recusa etapa de outro funil da mesma organização", async () => {
    // O caso sutil: a etapa É da organização, mas de outro funil. Aceitar
    // deixaria o card fora de qualquer coluna do board dele.
    const { etapas } = await call(
      listStages,
      { funnelId: funilB },
      { context: s2sContext(admin, org) },
    );
    const etapaDeOutroFunil = etapas[0];
    if (!etapaDeOutroFunil) throw new Error("funil B sem etapa");

    await expect(
      call(
        updateLead,
        { leadId, estagioId: etapaDeOutroFunil.id },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/etapa não encontrada/i);
  });

  it("recusa responsável que não é da organização", async () => {
    await expect(
      call(
        updateLead,
        { leadId, responsavelId: adminDaOutra.id },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/responsável não encontrado/i);
  });

  it("aceita responsável que é membro", async () => {
    await call(
      updateLead,
      { leadId, responsavelId: admin.id },
      { context: s2sContext(admin, org) },
    );
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
    });
    expect(lead.responsibleId).toBe(admin.id);
  });

  it("recusa lead de outra organização", async () => {
    await expect(
      call(
        updateLead,
        { leadId, temperatura: "HOT" },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("crm.stage.list", () => {
  it("lista as etapas em ordem e conta os leads", async () => {
    const { etapas } = await call(
      listStages,
      { funnelId: funilA },
      { context: s2sContext(admin, org) },
    );

    expect(etapas.map((etapa) => etapa.nome)).toEqual([
      "Novo",
      "Em atendimento",
      "Proposta",
      "Ganho",
      "Perdido",
    ]);
    expect(
      etapas.find((etapa) => etapa.nome === "Proposta")?.totalDeLeads,
    ).toBe(1);
  });

  it("recusa funil de outra organização", async () => {
    await expect(
      call(
        listStages,
        { funnelId: funilA },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});
