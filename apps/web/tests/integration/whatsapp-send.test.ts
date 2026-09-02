import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Envio de mensagem.
 *
 * O provedor é dublado: o que interessa aqui é a **ordem** e os efeitos —
 * resolver antes de enviar, gravar só depois da confirmação, e o que a
 * gravação atualiza no lead. Bater na Graph de verdade num teste tornaria a
 * suíte dependente de rede e de credencial.
 */

const enviarTexto = vi.fn();

vi.mock("@/features/whatsapp-chat/lib/providers", async () => {
  const reais = await vi.importActual<
    typeof import("@/features/whatsapp-chat/lib/providers/outbound-errors")
  >("@/features/whatsapp-chat/lib/providers/outbound-errors");
  return {
    ...reais,
    resolveOutboundProvider: vi.fn(async () => ({
      provider: { id: "meta-cloud", sendText: enviarTexto },
      providerId: "meta-cloud",
      connectionId: "conexao-de-teste",
      organizationId: "ignorado",
      funnelId: "ignorado",
    })),
  };
});

const { createFunnel } = await import("@/app/router/crm/create-funnel");
const { sendMessage } = await import("@/app/router/message/send");
const { listMessages } = await import("@/app/router/message/list");
const { listConversations } = await import("@/app/router/conversation/list");
const { markRead } = await import("@/app/router/conversation/mark-read");
const { ConnectionNotFoundError } = await import(
  "@/features/whatsapp-chat/lib/providers/outbound-errors"
);
const { persistInboundMessage } = await import(
  "@/features/whatsapp-chat/lib/inbound/persist-inbound-message"
);
const prisma = (await import("@/lib/db")).default;
const { createMember, createOrg, createUser, resetDb, s2sContext } =
  await import("./helpers");
const { resolveOutboundProvider } = await import(
  "@/features/whatsapp-chat/lib/providers"
);

type Org = Awaited<ReturnType<typeof createOrg>>;
type Usuario = Awaited<ReturnType<typeof createUser>>;

let org: Org;
let outraOrg: Org;
let admin: Usuario;
let adminDaOutra: Usuario;
let funnelId: string;
let conversationId: string;
let leadId: string;

function mensagemRecebida(id: string, quando: Date) {
  return {
    type: "text" as const,
    externalMessageId: id,
    sentAt: quando,
    sender: { phone: "5586999998888", displayName: "Cliente", fromMe: false },
    instance: { externalId: "1234567890" },
    body: "oi, tudo bem?",
  };
}

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede que envia");
  outraOrg = await createOrg("Rede vizinha");
  admin = await createUser();
  adminDaOutra = await createUser();
  await createMember(admin, org);
  await createMember(adminDaOutra, outraOrg);

  const funil = await call(
    createFunnel,
    { name: "Atendimento" },
    { context: s2sContext(admin, org) },
  );
  funnelId = funil.id;

  // Uma mensagem recebida agora abre a janela de 24 horas.
  const recebida = await persistInboundMessage(
    mensagemRecebida("wamid.RECEBIDA-1", new Date()),
    { organizationId: org.id, funnelId },
  );
  if (!("conversationId" in recebida)) throw new Error("setup falhou");
  conversationId = recebida.conversationId;
  leadId = recebida.leadId;
});

afterAll(resetDb);

describe("message.send", () => {
  it("resolve o provedor, envia e grava com um tique", async () => {
    enviarTexto.mockResolvedValueOnce({
      externalMessageId: "wamid.ENVIADA-1",
      raw: {},
    });

    const resultado = await call(
      sendMessage,
      { conversationId, corpo: "Claro, posso ajudar" },
      { context: s2sContext(admin, org) },
    );

    expect(enviarTexto).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "5586999998888",
        body: "Claro, posso ajudar",
      }),
    );

    const gravada = await prisma.message.findUniqueOrThrow({
      where: { id: resultado.id },
    });
    expect(gravada.fromMe).toBe(true);
    // Saiu daqui: um tique. Entregue e lido chegam depois, pelo webhook.
    expect(gravada.status).toBe("SENT");
    // Mensagem nossa nunca conta como não-lida.
    expect(gravada.seen).toBe(true);
  });

  it("marca o tempo de primeira resposta e tira o lead da espera", async () => {
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: leadId },
    });
    expect(lead.firstResponseAt).not.toBeNull();
    expect(lead.statusFlow).toBe("ACTIVE");
    expect(lead.lastOutboundAt).not.toBeNull();
  });

  it("não grava nada quando o provedor falha", async () => {
    const antes = await prisma.message.count({
      where: { organizationId: org.id, fromMe: true },
    });

    enviarTexto.mockRejectedValueOnce(new Error("Graph fora do ar"));

    await expect(
      call(
        sendMessage,
        { conversationId, corpo: "não deve entrar" },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow();

    // Uma bolha no banco que o cliente nunca recebeu é pior que um erro na tela.
    expect(
      await prisma.message.count({
        where: { organizationId: org.id, fromMe: true },
      }),
    ).toBe(antes);
  });

  it("recusa antes de chamar a Meta quando a janela de 24h fechou", async () => {
    const vinteECincoHorasAtras = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.crmLead.update({
      where: { id: leadId },
      data: { lastInboundAt: vinteECincoHorasAtras },
    });

    enviarTexto.mockClear();

    await expect(
      call(
        sendMessage,
        { conversationId, corpo: "fora da janela" },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/janela de 24 horas/i);

    // Não gastou ida à Meta para descobrir o que já dava para saber aqui.
    expect(enviarTexto).not.toHaveBeenCalled();

    await prisma.crmLead.update({
      where: { id: leadId },
      data: { lastInboundAt: new Date() },
    });
  });

  it("traduz erro do provedor em mensagem com código", async () => {
    enviarTexto.mockRejectedValueOnce(new ConnectionNotFoundError(funnelId));

    await expect(
      call(
        sendMessage,
        { conversationId, corpo: "qualquer" },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/Nenhum número de WhatsApp conectado/i);
  });

  it("recusa conversa de outra organização", async () => {
    await expect(
      call(
        sendMessage,
        { conversationId, corpo: "invadindo" },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrada/i);
  });

  it("resolve o provedor com a organização do contexto, não só com o funil", async () => {
    expect(resolveOutboundProvider).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: org.id, funnelId }),
    );
  });
});

describe("leitura da conversa", () => {
  it("lista as mensagens da mais nova para a mais antiga, sem a chave da mídia", async () => {
    const resultado = await call(
      listMessages,
      { conversationId, limite: 30 },
      { context: s2sContext(admin, org) },
    );

    expect(resultado.mensagens.length).toBeGreaterThan(0);
    const serializado = JSON.stringify(resultado);
    // A chave do bucket privado nunca atravessa a fronteira.
    expect(serializado).not.toContain("whatsapp/");
    expect(resultado.mensagens[0]).toHaveProperty("temMidia");
  });

  it("conta como não-lida só a mensagem que o cliente mandou", async () => {
    const antes = await call(
      listConversations,
      { funnelId, limite: 20 },
      { context: s2sContext(admin, org) },
    );
    // Recebemos uma e respondemos uma: só a recebida conta.
    expect(antes.conversas[0]?.naoLidas).toBe(1);

    await call(
      markRead,
      { conversationId },
      { context: s2sContext(admin, org) },
    );

    const depois = await call(
      listConversations,
      { funnelId, limite: 20 },
      { context: s2sContext(admin, org) },
    );
    expect(depois.conversas[0]?.naoLidas).toBe(0);
  });

  it("marcar como lida não mexe nos tiques da mensagem enviada", async () => {
    // `seen` é o badge do atendente; `status` é o tique que o cliente vê.
    const enviada = await prisma.message.findFirstOrThrow({
      where: { organizationId: org.id, fromMe: true },
    });
    expect(enviada.status).toBe("SENT");
  });

  it("não lista conversa de outra organização", async () => {
    await expect(
      call(
        listConversations,
        { funnelId, limite: 20 },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrado/i);
  });
});
