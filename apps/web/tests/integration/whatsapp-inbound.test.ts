import { readFileSync } from "node:fs";
import path from "node:path";
import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFunnel } from "@/app/router/crm/create-funnel";
import { MetaCloudProvider } from "@/features/whatsapp-chat/lib/providers/adapters/meta-cloud/provider";
import type { CanonicalInboundMessage } from "@/features/whatsapp-chat/lib/providers/types";
import { applyStatusUpdates } from "@/features/whatsapp-chat/lib/inbound/apply-status-updates";
import { persistInboundMessage } from "@/features/whatsapp-chat/lib/inbound/persist-inbound-message";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { unwrapCapturedFixture } from "@/lib/whatsapp-cloud";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Pipeline de entrada — o caminho que uma mensagem recebida percorre.
 *
 * Os payloads não são inventados: passam pelo adapter a partir das capturas
 * reais de webhook, então o que o teste exercita é a mesma normalização que
 * roda em produção.
 *
 * O teste central é a **reentrega**: a Meta reenvia o mesmo evento em qualquer
 * resposta 5xx, e sem `upsert` por `externalMessageId` a bolha duplica na
 * conversa. É o bug que a spec do projeto de origem registra como o mais caro
 * deste domínio.
 */

const TELEFONE_DA_CAPTURA = "558688923098";

function canonicaDaCaptura(nome: string): CanonicalInboundMessage {
  const arquivo = path.resolve(
    __dirname,
    "../../src/lib/whatsapp-cloud/__fixtures__",
    nome,
  );
  const payload = unwrapCapturedFixture(
    JSON.parse(readFileSync(arquivo, "utf8")),
  );
  const provider = new MetaCloudProvider({
    accessToken: "token-de-teste",
    phoneNumberId: "1098624330008863",
  });
  const normalizado = provider.normalizeInbound(payload);
  const mensagem = normalizado?.messages[0];
  if (!mensagem) throw new Error(`captura ${nome} sem mensagem`);
  return mensagem;
}

let org: Organization;
let outraOrg: Organization;
let admin: User;
let funnelId: string;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede do chat");
  outraOrg = await createOrg("Rede vizinha");
  admin = await createUser();
  await createMember(admin, org);

  const funil = await call(
    createFunnel,
    { name: "Atendimento" },
    { context: s2sContext(admin, org) },
  );
  funnelId = funil.id;
});

afterAll(resetDb);

const contexto = () => ({ organizationId: org.id, funnelId });

describe("persistInboundMessage — primeira mensagem de um número novo", () => {
  it("cria lead, conversa e mensagem", async () => {
    const resultado = await persistInboundMessage(
      canonicaDaCaptura("message.json"),
      contexto(),
    );

    expect(resultado.ok).toBe(true);
    if (!("messageId" in resultado))
      throw new Error("esperava mensagem gravada");
    expect(resultado.leadCriado).toBe(true);

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: resultado.leadId },
    });
    expect(lead.phone).toBe(TELEFONE_DA_CAPTURA);
    expect(lead.organizationId).toBe(org.id);
    expect(lead.source).toBe("WHATSAPP");
    // Chegou e ninguém respondeu: é o que destaca quem está esperando.
    expect(lead.statusFlow).toBe("WAITING");
    expect(lead.stageId).toBeTruthy();
  });

  it("a mensagem nasce entregue mas não lida", async () => {
    const mensagem = await prisma.message.findFirstOrThrow({
      where: { organizationId: org.id },
    });
    // `status` são os tiques; `seen` é o badge de não-lidas. São coisas
    // diferentes, e trocar uma pela outra quebra o contador em silêncio.
    expect(mensagem.status).toBe("SEEN");
    expect(mensagem.seen).toBe(false);
    expect(mensagem.fromMe).toBe(false);
  });
});

describe("reentrega do mesmo evento", () => {
  it("não duplica a mensagem", async () => {
    const antes = await prisma.message.count({
      where: { organizationId: org.id },
    });

    // A Meta reentrega o mesmo webhook em qualquer 5xx.
    await persistInboundMessage(canonicaDaCaptura("message.json"), contexto());
    await persistInboundMessage(canonicaDaCaptura("message.json"), contexto());

    const depois = await prisma.message.count({
      where: { organizationId: org.id },
    });
    expect(depois).toBe(antes);
  });

  it("não cria um segundo lead para o mesmo número no mesmo funil", async () => {
    const leads = await prisma.crmLead.count({
      where: { organizationId: org.id, phone: TELEFONE_DA_CAPTURA },
    });
    expect(leads).toBe(1);
  });
});

describe("tipos de mensagem", () => {
  it("grava imagem com o tipo e sem arquivo quando não há estratégia de download", async () => {
    // Sem `baixarMidia` a mensagem entra assim mesmo: perder a bolha seria
    // pior que exibi-la sem o arquivo.
    const resultado = await persistInboundMessage(
      canonicaDaCaptura("image.json"),
      contexto(),
    );
    if (!("messageId" in resultado))
      throw new Error("esperava mensagem gravada");

    const mensagem = await prisma.message.findUniqueOrThrow({
      where: { id: resultado.messageId },
    });
    expect(mensagem.mediaType).toBe("image");
    expect(mensagem.mediaKey).toBeNull();
    expect(mensagem.mimetype).toContain("image/");
  });

  it("ignora reação sem gravar bolha", async () => {
    const base = canonicaDaCaptura("message.json");
    const reacao: CanonicalInboundMessage = {
      ...base,
      type: "reaction",
      externalMessageId: "wamid.REACAO",
      targetExternalMessageId: base.externalMessageId,
      emoji: "👍",
    } as CanonicalInboundMessage;

    const resultado = await persistInboundMessage(reacao, contexto());
    expect(resultado).toMatchObject({ ok: true, ignorado: "reacao" });
    expect(
      await prisma.message.count({
        where: { externalMessageId: "wamid.REACAO" },
      }),
    ).toBe(0);
  });

  it("recusa id externo vazio em vez de gravar chave em branco", async () => {
    // A coluna é única: string vazia colidiria na próxima ocorrência.
    const base = canonicaDaCaptura("message.json");
    const semId = { ...base, externalMessageId: "" } as CanonicalInboundMessage;
    const resultado = await persistInboundMessage(semId, contexto());
    expect(resultado).toMatchObject({ ok: true, ignorado: "id_externo_vazio" });
  });
});

describe("reativação e vínculo com o cliente do ERP", () => {
  it("cliente que volta a falar reabre o atendimento encerrado", async () => {
    const lead = await prisma.crmLead.findFirstOrThrow({
      where: { organizationId: org.id, phone: TELEFONE_DA_CAPTURA },
    });
    await prisma.crmLead.update({
      where: { id: lead.id },
      data: { statusFlow: "FINISHED" },
    });

    const base = canonicaDaCaptura("message.json");
    await persistInboundMessage(
      { ...base, externalMessageId: "wamid.DEPOIS-DE-ENCERRAR" },
      contexto(),
    );

    const depois = await prisma.crmLead.findUniqueOrThrow({
      where: { id: lead.id },
    });
    expect(depois.statusFlow).toBe("ACTIVE");
  });

  it("liga o lead ao cliente do ERP quando o telefone casa com um só", async () => {
    const cliente = await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: "Cliente conhecido",
        phone: `+${TELEFONE_DA_CAPTURA}`,
      },
    });

    const outroFunil = await call(
      createFunnel,
      { name: "Pós-venda" },
      { context: s2sContext(admin, org) },
    );

    const resultado = await persistInboundMessage(
      {
        ...canonicaDaCaptura("message.json"),
        externalMessageId: "wamid.OUTRO-FUNIL",
      },
      { organizationId: org.id, funnelId: outroFunil.id },
    );
    if (!("leadId" in resultado)) throw new Error("esperava lead");

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: resultado.leadId },
    });
    expect(lead.customerId).toBe(cliente.id);
  });

  it("não chuta o cliente quando dois têm o mesmo telefone", async () => {
    await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: "Homônimo",
        phone: `+${TELEFONE_DA_CAPTURA}`,
      },
    });

    const terceiroFunil = await call(
      createFunnel,
      { name: "Suporte" },
      { context: s2sContext(admin, org) },
    );

    const resultado = await persistInboundMessage(
      {
        ...canonicaDaCaptura("message.json"),
        externalMessageId: "wamid.AMBIGUO",
      },
      { organizationId: org.id, funnelId: terceiroFunil.id },
    );
    if (!("leadId" in resultado)) throw new Error("esperava lead");

    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: resultado.leadId },
    });
    // Ambiguidade deixa o lead solto — o atendente decide, o sistema não chuta.
    expect(lead.customerId).toBeNull();
  });
});

describe("applyStatusUpdates", () => {
  it("avança o tique e nunca regride", async () => {
    const mensagem = await prisma.message.create({
      data: {
        organizationId: org.id,
        conversationId: (
          await prisma.conversation.findFirstOrThrow({
            where: { organizationId: org.id },
          })
        ).id,
        externalMessageId: "wamid.ENVIADA-POR-NOS",
        fromMe: true,
        body: "oi",
        status: "SENT",
      },
    });

    const agora = new Date();
    await applyStatusUpdates(
      [
        {
          externalMessageId: "wamid.ENVIADA-POR-NOS",
          status: "read",
          at: agora,
        },
      ],
      org.id,
    );
    expect(
      (await prisma.message.findUniqueOrThrow({ where: { id: mensagem.id } }))
        .status,
    ).toBe("SEEN");

    // Aviso de "entregue" atrasado não pode desfazer o tique azul.
    await applyStatusUpdates(
      [
        {
          externalMessageId: "wamid.ENVIADA-POR-NOS",
          status: "delivered",
          at: agora,
        },
      ],
      org.id,
    );
    expect(
      (await prisma.message.findUniqueOrThrow({ where: { id: mensagem.id } }))
        .status,
    ).toBe("SEEN");
  });

  it("não alcança mensagem de outra organização", async () => {
    const { aplicadas } = await applyStatusUpdates(
      [
        {
          externalMessageId: "wamid.ENVIADA-POR-NOS",
          status: "failed",
          at: new Date(),
        },
      ],
      outraOrg.id,
    );
    expect(aplicadas).toBe(0);
  });
});
