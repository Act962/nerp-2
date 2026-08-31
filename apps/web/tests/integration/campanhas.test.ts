import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Campanhas — o que quebra de verdade num disparo em massa.
 *
 * Três coisas custam caro aqui e são o que estes testes protegem:
 * disparar duas vezes (cliente recebe em dobro), o contador inflar (relatório
 * mente) e o lote reenviar para quem já recebeu depois de uma falha.
 *
 * O provedor é dublado — o que importa é a orquestração, não a Graph API.
 */

const enviarTemplate = vi.fn();

vi.mock("@/features/whatsapp-chat/lib/providers", async () => {
  const erros = await vi.importActual<
    typeof import("@/features/whatsapp-chat/lib/providers/outbound-errors")
  >("@/features/whatsapp-chat/lib/providers/outbound-errors");
  return {
    ...erros,
    modoDemoLigado: () => true,
    resolveOutboundProvider: vi.fn(async () => ({
      provider: { id: "demo", sendTemplate: enviarTemplate },
      providerId: "demo",
      connectionId: "demo",
      organizationId: "ignorado",
      funnelId: "ignorado",
    })),
  };
});

// O envio real dispara evento no Inngest; aqui chamamos o lote direto.
const publicarEvento = vi.fn(async () => ({ ids: [] as string[] }));

vi.mock("@/lib/inngest/client", async () => {
  const real = await vi.importActual<typeof import("@/lib/inngest/client")>(
    "@/lib/inngest/client",
  );
  return { ...real, inngest: { send: publicarEvento } };
});

const { createFunnel } = await import("@/app/router/crm/create-funnel");
const { createCampanha } = await import("@/app/router/campanhas/create");
const { addRecipientsFromLeads } = await import(
  "@/app/router/campanhas/add-recipients"
);
const { setTemplate } = await import("@/app/router/campanhas/set-template");
const { sendCampanha } = await import("@/app/router/campanhas/send");
const { getCampanha } = await import("@/app/router/campanhas/get");
const { enviarLote } = await import("@/features/campanhas/server/enviar-lote");
const { aplicarStatusDeCampanha } = await import(
  "@/features/campanhas/server/aplicar-status"
);
const prisma = (await import("@/lib/db")).default;
const { createMember, createOrg, createUser, resetDb, s2sContext } =
  await import("./helpers");

type Org = Awaited<ReturnType<typeof createOrg>>;
type Usuario = Awaited<ReturnType<typeof createUser>>;

let org: Org;
let outraOrg: Org;
let admin: Usuario;
let adminDaOutra: Usuario;
let funnelId: string;
let campanhaId: string;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede que dispara");
  outraOrg = await createOrg("Rede vizinha");
  admin = await createUser();
  adminDaOutra = await createUser();
  await createMember(admin, org);
  await createMember(adminDaOutra, outraOrg);

  funnelId = (
    await call(
      createFunnel,
      { name: "Vendas" },
      { context: s2sContext(admin, org) },
    )
  ).id;

  const etapa = await prisma.crmStage.findFirstOrThrow({
    where: { funnelId },
    select: { id: true },
  });

  // Cinco com telefone, um sem — o sem telefone não pode entrar na audiência.
  for (let i = 0; i < 5; i += 1) {
    await prisma.crmLead.create({
      data: {
        organizationId: org.id,
        funnelId,
        stageId: etapa.id,
        name: `Cliente ${i + 1}`,
        phone: `55869555000${i}`,
      },
    });
  }
  await prisma.crmLead.create({
    data: {
      organizationId: org.id,
      funnelId,
      stageId: etapa.id,
      name: "Sem telefone",
    },
  });

  campanhaId = (
    await call(
      createCampanha,
      { funnelId, name: "Promoção de teste" },
      { context: s2sContext(admin, org) },
    )
  ).id;
});

afterAll(resetDb);

describe("audiência", () => {
  it("adiciona só quem tem telefone", async () => {
    const resultado = await call(
      addRecipientsFromLeads,
      { broadcastId: campanhaId, limite: 1000 },
      { context: s2sContext(admin, org) },
    );

    expect(resultado.adicionados).toBe(5);
    // Destinatário sem número seria uma falha garantida poluindo o relatório.
    expect(resultado.semTelefone).toBe(1);
  });

  it("adicionar de novo não duplica ninguém", async () => {
    const resultado = await call(
      addRecipientsFromLeads,
      { broadcastId: campanhaId, limite: 1000 },
      { context: s2sContext(admin, org) },
    );
    expect(resultado.adicionados).toBe(0);
    expect(resultado.jaEstavam).toBe(5);

    expect(
      await prisma.broadcastRecipient.count({
        where: { broadcastId: campanhaId },
      }),
    ).toBe(5);
  });

  it("recusa campanha de outra organização", async () => {
    await expect(
      call(
        addRecipientsFromLeads,
        { broadcastId: campanhaId, limite: 10 },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrada/i);
  });
});

describe("disparo", () => {
  it("recusa disparar sem template escolhido", async () => {
    await expect(
      call(
        sendCampanha,
        { broadcastId: campanhaId },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/template aprovado/i);
  });

  it("dispara uma vez e recusa a segunda", async () => {
    await call(
      setTemplate,
      {
        broadcastId: campanhaId,
        nome: "promocao_semanal",
        idioma: "pt_BR",
        categoria: "MARKETING",
        variaveis: ["cliente"],
      },
      { context: s2sContext(admin, org) },
    );

    const primeiro = await call(
      sendCampanha,
      { broadcastId: campanhaId },
      { context: s2sContext(admin, org) },
    );
    expect(primeiro.disparando).toBe(true);
    expect(primeiro.destinatarios).toBe(5);

    // Dois cliques rápidos: o segundo encontra a campanha já reivindicada e
    // para antes de enviar qualquer coisa. Sem isso, o cliente recebe em dobro.
    await expect(
      call(
        sendCampanha,
        { broadcastId: campanhaId },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/já está disparando/i);
  });
});

describe("fila de tarefas fora do ar", () => {
  it("desfaz a reivindicação quando não consegue publicar o disparo", async () => {
    // Sem isto a campanha ficaria presa em "disparando" para sempre: ninguém
    // a processaria, e a nova tentativa esbarraria na própria reivindicação.
    const presa = await call(
      createCampanha,
      { funnelId, name: "Fila fora do ar" },
      { context: s2sContext(admin, org) },
    );
    await call(
      addRecipientsFromLeads,
      { broadcastId: presa.id, limite: 1000 },
      { context: s2sContext(admin, org) },
    );
    await call(
      setTemplate,
      {
        broadcastId: presa.id,
        nome: "promocao_semanal",
        idioma: "pt_BR",
        categoria: "MARKETING",
      },
      { context: s2sContext(admin, org) },
    );

    publicarEvento.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      call(
        sendCampanha,
        { broadcastId: presa.id },
        { context: s2sContext(admin, org) },
      ),
    ).rejects.toThrow(/fila de tarefas/i);

    const depois = await prisma.broadcast.findUniqueOrThrow({
      where: { id: presa.id },
    });
    expect(depois.status).toBe("DRAFT");
    expect(depois.startedAt).toBeNull();

    // E a segunda tentativa funciona, agora com a fila de volta.
    const segunda = await call(
      sendCampanha,
      { broadcastId: presa.id },
      { context: s2sContext(admin, org) },
    );
    expect(segunda.disparando).toBe(true);
  });
});

describe("envio em lotes", () => {
  it("envia os pendentes e grava o id de cada mensagem", async () => {
    let contador = 0;
    enviarTemplate.mockImplementation(async () => ({
      externalMessageId: `wamid.CAMP-${contador++}`,
      raw: {},
    }));

    const resultado = await enviarLote({
      broadcastId: campanhaId,
      organizationId: org.id,
      funnelId,
    });

    expect(resultado.enviados).toBe(5);
    expect(resultado.restam).toBe(0);

    const campanha = await prisma.broadcast.findUniqueOrThrow({
      where: { id: campanhaId },
    });
    expect(campanha.sentCount).toBe(5);
    expect(campanha.totalRecipients).toBe(5);
  });

  it("repetir o lote não reenvia para quem já recebeu", async () => {
    // É o que acontece quando o Inngest refaz um passo depois de falha.
    enviarTemplate.mockClear();

    const resultado = await enviarLote({
      broadcastId: campanhaId,
      organizationId: org.id,
      funnelId,
    });

    expect(resultado.enviados).toBe(0);
    expect(enviarTemplate).not.toHaveBeenCalled();
  });

  it("falha de um destinatário não derruba o lote", async () => {
    const segunda = await call(
      createCampanha,
      { funnelId, name: "Com uma falha" },
      { context: s2sContext(admin, org) },
    );
    await call(
      addRecipientsFromLeads,
      { broadcastId: segunda.id, limite: 1000 },
      { context: s2sContext(admin, org) },
    );
    await call(
      setTemplate,
      {
        broadcastId: segunda.id,
        nome: "promocao_semanal",
        idioma: "pt_BR",
        categoria: "MARKETING",
      },
      { context: s2sContext(admin, org) },
    );
    await call(
      sendCampanha,
      { broadcastId: segunda.id },
      { context: s2sContext(admin, org) },
    );

    let chamada = 0;
    enviarTemplate.mockImplementation(async () => {
      chamada += 1;
      // Número inválido é comum numa lista grande; abortar deixaria os
      // seguintes sem chance de receber.
      if (chamada === 2) throw new Error("Recipient phone number invalid");
      return { externalMessageId: `wamid.FALHA-${chamada}`, raw: {} };
    });

    const resultado = await enviarLote({
      broadcastId: segunda.id,
      organizationId: org.id,
      funnelId,
    });

    expect(resultado.enviados).toBe(4);
    expect(resultado.falharam).toBe(1);

    const campanha = await prisma.broadcast.findUniqueOrThrow({
      where: { id: segunda.id },
    });
    expect(campanha.failedCount).toBe(1);
    expect(campanha.sentCount).toBe(4);
  });
});

describe("cobrança de ★ no lote", () => {
  /**
   * A regressão: a cobrança acontece DEPOIS do envio, para a repetição de um
   * lote não cobrar duas vezes pela mesma mensagem. Sem conferir o saldo antes
   * de enviar, a mensagem que esgota o saldo saía, era marcada `SENT` e nunca
   * era cobrada — e como deixava de estar `PENDING`, nenhuma rodada seguinte a
   * alcançava. Uma mensagem grátis por esgotamento, visível só cruzando o
   * extrato com o relatório.
   *
   * O que o teste fixa é a igualdade: toda mensagem que saiu foi cobrada.
   */
  it("não envia mensagem que não consegue cobrar", async () => {
    const comCobranca = await call(
      createCampanha,
      { funnelId, name: "Com cobrança" },
      { context: s2sContext(admin, org) },
    );
    await call(
      addRecipientsFromLeads,
      { broadcastId: comCobranca.id, limite: 1000 },
      { context: s2sContext(admin, org) },
    );
    await call(
      setTemplate,
      {
        broadcastId: comCobranca.id,
        nome: "promocao_semanal",
        idioma: "pt_BR",
        categoria: "MARKETING",
      },
      { context: s2sContext(admin, org) },
    );
    await call(
      sendCampanha,
      { broadcastId: comCobranca.id },
      { context: s2sContext(admin, org) },
    );

    const total = await prisma.broadcastRecipient.count({
      where: { broadcastId: comCobranca.id },
    });
    // Saldo para menos gente do que a campanha tem: é o esgotamento no meio.
    const saldo = total - 2;

    await prisma.starRule.create({
      data: {
        organizationId: org.id,
        actionKey: "campaign_recipient",
        label: "Destinatário de campanha",
        stars: 1,
        isActive: true,
      },
    });
    await prisma.organization.update({
      where: { id: org.id },
      data: { starsBalance: saldo },
    });

    let sequencia = 0;
    enviarTemplate.mockImplementation(async () => {
      sequencia += 1;
      return { externalMessageId: `wamid.COBRANCA-${sequencia}`, raw: {} };
    });

    const resultado = await enviarLote({
      broadcastId: comCobranca.id,
      organizationId: org.id,
      funnelId,
    });

    expect(resultado.semSaldo).toBe(true);
    expect(resultado.enviados).toBe(saldo);

    const cobrancas = await prisma.starTransaction.count({
      where: { organizationId: org.id, type: "APP_CHARGE" },
    });
    // O invariante: nenhuma mensagem saiu de graça.
    expect(cobrancas).toBe(resultado.enviados);

    const enviados = await prisma.broadcastRecipient.count({
      where: { broadcastId: comCobranca.id, status: "SENT" },
    });
    expect(enviados).toBe(cobrancas);

    // Quem não coube continua pendente, para quando houver crédito.
    expect(resultado.restam).toBe(total - saldo);

    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    expect(depois.starsBalance).toBe(0);

    await prisma.starRule.deleteMany({ where: { organizationId: org.id } });
  });
});

describe("avisos de entrega", () => {
  it("avança o status e recalcula os contadores", async () => {
    const destinatario = await prisma.broadcastRecipient.findFirstOrThrow({
      where: { broadcastId: campanhaId, status: "SENT" },
    });

    await aplicarStatusDeCampanha(
      [
        {
          externalMessageId: destinatario.externalMessageId as string,
          status: "delivered",
          at: new Date(),
        },
      ],
      org.id,
    );

    const campanha = await prisma.broadcast.findUniqueOrThrow({
      where: { id: campanhaId },
    });
    expect(campanha.deliveredCount).toBe(1);
    // "Enviadas" não cai quando a entrega é confirmada: quem foi entregue
    // também saiu.
    expect(campanha.sentCount).toBe(5);
  });

  it("o mesmo aviso repetido não infla o contador", async () => {
    // A Meta reentrega avisos. Se o contador fosse incrementado em vez de
    // recalculado, a campanha apareceria com mais entregas que destinatários.
    const destinatario = await prisma.broadcastRecipient.findFirstOrThrow({
      where: { broadcastId: campanhaId, status: "DELIVERED" },
    });
    const aviso = {
      externalMessageId: destinatario.externalMessageId as string,
      status: "delivered" as const,
      at: new Date(),
    };

    await aplicarStatusDeCampanha([aviso], org.id);
    await aplicarStatusDeCampanha([aviso], org.id);

    const campanha = await prisma.broadcast.findUniqueOrThrow({
      where: { id: campanhaId },
    });
    expect(campanha.deliveredCount).toBe(1);
  });

  it("aviso de entrega atrasado não desfaz a leitura", async () => {
    const destinatario = await prisma.broadcastRecipient.findFirstOrThrow({
      where: { broadcastId: campanhaId, status: "DELIVERED" },
    });
    const wamid = destinatario.externalMessageId as string;

    await aplicarStatusDeCampanha(
      [{ externalMessageId: wamid, status: "read", at: new Date() }],
      org.id,
    );
    await aplicarStatusDeCampanha(
      [{ externalMessageId: wamid, status: "delivered", at: new Date() }],
      org.id,
    );

    const atual = await prisma.broadcastRecipient.findUniqueOrThrow({
      where: { id: destinatario.id },
    });
    expect(atual.status).toBe("READ");
  });

  it("não alcança destinatário de outra organização", async () => {
    const destinatario = await prisma.broadcastRecipient.findFirstOrThrow({
      where: { broadcastId: campanhaId, status: "READ" },
    });
    const { aplicadas } = await aplicarStatusDeCampanha(
      [
        {
          externalMessageId: destinatario.externalMessageId as string,
          status: "failed",
          at: new Date(),
        },
      ],
      outraOrg.id,
    );
    expect(aplicadas).toBe(0);
  });
});

describe("campanhas.get", () => {
  it("recusa campanha de outra organização", async () => {
    await expect(
      call(
        getCampanha,
        { broadcastId: campanhaId },
        { context: s2sContext(adminDaOutra, outraOrg) },
      ),
    ).rejects.toThrow(/não encontrada/i);
  });
});
