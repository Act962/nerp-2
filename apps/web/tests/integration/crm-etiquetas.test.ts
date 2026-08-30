import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeLead } from "@/app/router/crm/close-lead";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { createReason } from "@/app/router/crm/motivos/create";
import { listReasons } from "@/app/router/crm/motivos/list";
import { archiveTag } from "@/app/router/crm/tags/archive";
import { createTag } from "@/app/router/crm/tags/create";
import { listTags } from "@/app/router/crm/tags/list";
import { setTagsOnLead } from "@/app/router/crm/tags/set-on-lead";
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
 * Etiquetas e motivos de ganho/perda.
 *
 * O que estes testes prendem: etiqueta some do seletor sem levar o histórico
 * junto, id de outra organização não vira vínculo, e o motivo não entra do
 * lado errado do relatório.
 */

let org: Organization;
let outraOrg: Organization;
let dono: User;
let vizinho: User;
let funnelId: string;
let outroFunnelId: string;
let leadId: string;

const ctx = () => ({ context: s2sContext(dono, org) });
const doVizinho = () => ({ context: s2sContext(vizinho, outraOrg) });

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja com etiquetas");
  outraOrg = await createOrg("Loja vizinha");
  dono = await createUser();
  vizinho = await createUser();
  await createMember(dono, org);
  await createMember(vizinho, outraOrg);

  funnelId = (await call(createFunnel, { name: "Atendimento" }, ctx())).id;
  outroFunnelId = (await call(createFunnel, { name: "Pós-venda" }, ctx())).id;
});

beforeEach(async () => {
  // As duas organizações: um caso cria etiqueta do lado da vizinha para provar
  // que ela não atravessa, e a sobra confundiria a contagem do caso seguinte.
  const ambas = { organizationId: { in: [org.id, outraOrg.id] } };
  await prisma.crmTag.deleteMany({ where: ambas });
  await prisma.crmWinLossReason.deleteMany({ where: ambas });
  await prisma.crmLead.deleteMany({ where: ambas });

  const etapa = await prisma.crmStage.findFirstOrThrow({
    where: { funnelId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  leadId = (
    await prisma.crmLead.create({
      data: {
        organizationId: org.id,
        funnelId,
        stageId: etapa.id,
        name: "Rita Alencar",
        phone: "+5585988880000",
      },
      select: { id: true },
    })
  ).id;
});

afterAll(resetDb);

describe("etiquetas", () => {
  it("cria e lista, com as gerais valendo em qualquer funil", async () => {
    await call(createTag, { nome: "Urgente", cor: "#ef4444" }, ctx());
    await call(
      createTag,
      { nome: "Só no pós", funnelId: outroFunnelId },
      ctx(),
    );

    const noAtendimento = await call(listTags, { funnelId }, ctx());
    expect(noAtendimento.etiquetas.map((e) => e.nome)).toEqual(["Urgente"]);

    const noPosVenda = await call(listTags, { funnelId: outroFunnelId }, ctx());
    // A geral aparece nos dois; a do funil só no dela.
    expect(noPosVenda.etiquetas.map((e) => e.nome).sort()).toEqual([
      "Só no pós",
      "Urgente",
    ]);
  });

  it("recusa nome repetido no mesmo escopo", async () => {
    await call(createTag, { nome: "Urgente" }, ctx());
    await expect(call(createTag, { nome: "Urgente" }, ctx())).rejects.toThrow(
      /já existe/i,
    );
  });

  it("recriar uma arquivada é reativá-la, não duplicar", async () => {
    const criada = await call(createTag, { nome: "Frete grátis" }, ctx());
    await call(archiveTag, { tagId: criada.id }, ctx());

    const revivida = await call(createTag, { nome: "Frete grátis" }, ctx());
    // O histórico que aponta para ela volta a fazer sentido.
    expect(revivida.id).toBe(criada.id);

    const total = await prisma.crmTag.count({
      where: { organizationId: org.id, name: "Frete grátis" },
    });
    expect(total).toBe(1);
  });

  it("arquivar some do seletor sem apagar a marcação do contato", async () => {
    const criada = await call(createTag, { nome: "VIP" }, ctx());
    await call(setTagsOnLead, { leadId, tagIds: [criada.id] }, ctx());

    await call(archiveTag, { tagId: criada.id }, ctx());

    const seletor = await call(listTags, { funnelId }, ctx());
    expect(seletor.etiquetas).toHaveLength(0);

    // O vínculo continua: é o que responde "por que este contato foi marcado".
    const vinculos = await prisma.crmLeadTag.count({ where: { leadId } });
    expect(vinculos).toBe(1);
  });

  it("grava a lista inteira e registra entrada e saída no histórico", async () => {
    const a = await call(createTag, { nome: "Quente" }, ctx());
    const b = await call(createTag, { nome: "Revenda" }, ctx());

    await call(setTagsOnLead, { leadId, tagIds: [a.id, b.id] }, ctx());
    await call(setTagsOnLead, { leadId, tagIds: [b.id] }, ctx());

    const atuais = await prisma.crmLeadTag.findMany({
      where: { leadId },
      select: { tagId: true },
    });
    expect(atuais.map((t) => t.tagId)).toEqual([b.id]);

    const adicoes = await prisma.crmLeadHistory.count({
      where: { leadId, eventType: "TAG_ADDED" },
    });
    const remocoes = await prisma.crmLeadHistory.count({
      where: { leadId, eventType: "TAG_REMOVED" },
    });
    expect(adicoes).toBe(2);
    expect(remocoes).toBe(1);
  });

  it("salvar sem mudança não polui o histórico", async () => {
    const a = await call(createTag, { nome: "Quente" }, ctx());
    await call(setTagsOnLead, { leadId, tagIds: [a.id] }, ctx());
    await call(setTagsOnLead, { leadId, tagIds: [a.id] }, ctx());

    const eventos = await prisma.crmLeadHistory.count({
      where: { leadId, eventType: { in: ["TAG_ADDED", "TAG_REMOVED"] } },
    });
    expect(eventos).toBe(1);
  });

  it("não pendura etiqueta de outra organização", async () => {
    const daVizinha = await prisma.crmTag.create({
      data: {
        organizationId: outraOrg.id,
        name: "De fora",
        slug: "de-fora",
      },
      select: { id: true },
    });

    await expect(
      call(setTagsOnLead, { leadId, tagIds: [daVizinha.id] }, ctx()),
    ).rejects.toThrow(/não existe mais|não vale/i);

    expect(await prisma.crmLeadTag.count({ where: { leadId } })).toBe(0);
  });

  it("não pendura etiqueta que é de outro funil", async () => {
    const doOutroFunil = await call(
      createTag,
      { nome: "Só pós-venda", funnelId: outroFunnelId },
      ctx(),
    );

    await expect(
      call(setTagsOnLead, { leadId, tagIds: [doOutroFunil.id] }, ctx()),
    ).rejects.toThrow(/não vale neste funil/i);
  });

  it("a organização vizinha não enxerga nem arquiva", async () => {
    const minha = await call(createTag, { nome: "Minha" }, ctx());

    const dela = await call(listTags, {}, doVizinho());
    expect(dela.etiquetas).toHaveLength(0);

    await expect(
      call(archiveTag, { tagId: minha.id }, doVizinho()),
    ).rejects.toThrow(/não encontrada/i);
  });
});

describe("ganho e perda", () => {
  it("encerra com motivo e guarda no histórico", async () => {
    const motivo = await call(
      createReason,
      { funnelId, nome: "Preço", tipo: "LOSS" },
      ctx(),
    );

    await call(
      closeLead,
      {
        leadId,
        resultado: "LOST",
        reasonId: motivo.id,
        observacao: "Achou mais barato na concorrência",
      },
      ctx(),
    );

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { currentAction: true, statusFlow: true },
    });
    expect(lead.currentAction).toBe("LOST");
    expect(lead.statusFlow).toBe("FINISHED");

    const registro = await prisma.crmLeadHistory.findFirstOrThrow({
      where: { leadId, eventType: "ACTION_CHANGE" },
      select: { reasonId: true, notes: true },
    });
    expect(registro.reasonId).toBe(motivo.id);
    expect(registro.notes).toContain("concorrência");
  });

  it("recusa motivo do lado errado", async () => {
    const perda = await call(
      createReason,
      { funnelId, nome: "Preço", tipo: "LOSS" },
      ctx(),
    );

    // Motivo de perda num ganho entra no relatório do lado errado e ninguém
    // percebe.
    await expect(
      call(closeLead, { leadId, resultado: "WON", reasonId: perda.id }, ctx()),
    ).rejects.toThrow(/outro resultado/i);
  });

  it("recusa motivo de outro funil", async () => {
    const deOutroFunil = await call(
      createReason,
      { funnelId: outroFunnelId, nome: "Sem estoque", tipo: "LOSS" },
      ctx(),
    );

    await expect(
      call(
        closeLead,
        { leadId, resultado: "LOST", reasonId: deOutroFunil.id },
        ctx(),
      ),
    ).rejects.toThrow(/não encontrado/i);
  });

  it("reabrir volta o contato para ativo sem apagar a passagem anterior", async () => {
    const motivo = await call(
      createReason,
      { funnelId, nome: "Sumiu", tipo: "LOSS" },
      ctx(),
    );
    await call(
      closeLead,
      { leadId, resultado: "LOST", reasonId: motivo.id },
      ctx(),
    );
    await call(closeLead, { leadId, resultado: "REABRIR" }, ctx());

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { currentAction: true, statusFlow: true },
    });
    expect(lead.currentAction).toBe("ACTIVE");
    expect(lead.statusFlow).toBe("ACTIVE");

    // As duas passagens interessam: um contato pode ser perdido de novo por
    // outro motivo.
    const passagens = await prisma.crmLeadHistory.count({
      where: { leadId, eventType: "ACTION_CHANGE" },
    });
    expect(passagens).toBe(2);
  });

  it("lista os motivos só do funil pedido", async () => {
    await call(createReason, { funnelId, nome: "Preço", tipo: "LOSS" }, ctx());
    await call(
      createReason,
      { funnelId: outroFunnelId, nome: "Outro", tipo: "LOSS" },
      ctx(),
    );

    const lista = await call(listReasons, { funnelId }, ctx());
    expect(lista.motivos.map((m) => m.nome)).toEqual(["Preço"]);

    await expect(call(listReasons, { funnelId }, doVizinho())).rejects.toThrow(
      /não encontrado/i,
    );
  });
});
