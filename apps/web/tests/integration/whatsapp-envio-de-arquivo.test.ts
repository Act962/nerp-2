import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * Envio de arquivo pela conversa.
 *
 * Provedor e bucket dublados: o que interessa é a **ordem** — subir antes de
 * cobrar, cobrar antes de enviar, gravar só depois da confirmação — e o que
 * acontece quando cada etapa falha.
 */

const subir = vi.fn(async () => ({ mediaId: "meta-media-1" }));
const enviar = vi.fn(async (_entrada: Record<string, unknown>) => ({
  externalMessageId: "wamid.ARQUIVO-1",
}));

vi.mock("@/features/whatsapp-chat/lib/providers", async () => {
  const reais = await vi.importActual<
    typeof import("@/features/whatsapp-chat/lib/providers/outbound-errors")
  >("@/features/whatsapp-chat/lib/providers/outbound-errors");
  return {
    ...reais,
    resolveOutboundProvider: vi.fn(async () => ({
      provider: { id: "meta-cloud", uploadMedia: subir, sendMedia: enviar },
      providerId: "meta-cloud",
      connectionId: "conexao-de-teste",
      organizationId: "ignorado",
      funnelId: "ignorado",
    })),
  };
});

const guardar = vi.fn(async () => {});
vi.mock("@/features/whatsapp-chat/lib/media-storage", async () => {
  const reais = await vi.importActual<
    typeof import("@/features/whatsapp-chat/lib/media-storage")
  >("@/features/whatsapp-chat/lib/media-storage");
  return { ...reais, guardarMidia: guardar };
});

const { conferirArquivo, enviarMidia, tipoDaMidia } = await import(
  "@/features/whatsapp-chat/server/enviar-midia"
);
const { persistInboundMessage } = await import(
  "@/features/whatsapp-chat/lib/inbound/persist-inbound-message"
);
const prisma = (await import("@/lib/db")).default;
const { call } = await import("@orpc/server");
const { createFunnel } = await import("@/app/router/crm/create-funnel");
const { createMember, createOrg, createUser, resetDb, s2sContext } =
  await import("./helpers");

type Org = Awaited<ReturnType<typeof createOrg>>;
type Usuario = Awaited<ReturnType<typeof createUser>>;

let org: Org;
let dono: Usuario;
let funnelId: string;
let conversationId: string;

const ARQUIVO = Buffer.from("conteudo-de-teste");

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja que manda arquivo");
  dono = await createUser();
  await createMember(dono, org);

  funnelId = (
    await call(
      createFunnel,
      { name: "Atendimento" },
      { context: s2sContext(dono, org) },
    )
  ).id;
});

beforeEach(async () => {
  vi.clearAllMocks();
  subir.mockResolvedValue({ mediaId: "meta-media-1" });
  enviar.mockResolvedValue({ externalMessageId: `wamid.A-${Math.random()}` });

  await prisma.conversation.deleteMany({ where: { organizationId: org.id } });
  await prisma.crmLead.deleteMany({ where: { organizationId: org.id } });

  // Uma mensagem recebida agora abre a janela de 24h.
  const recebida = await persistInboundMessage(
    {
      externalMessageId: `wamid.IN-${Math.random()}`,
      type: "text",
      body: "oi",
      sentAt: new Date(),
      sender: { phone: "+5511977770000", displayName: "Cliente" },
      raw: {},
    } as never,
    { organizationId: org.id, funnelId },
  );
  conversationId = (recebida as { conversationId: string }).conversationId;
});

afterAll(resetDb);

describe("o que o WhatsApp aceita", () => {
  it("deduz o tipo pela família do mimetype", () => {
    expect(tipoDaMidia("image/jpeg")).toBe("image");
    expect(tipoDaMidia("image/webp")).toBe("sticker");
    expect(tipoDaMidia("video/mp4")).toBe("video");
    expect(tipoDaMidia("audio/ogg")).toBe("audio");
    expect(tipoDaMidia("application/pdf")).toBe("document");
  });

  it("recusa formato de imagem que a Meta não aceita", () => {
    // Antes do upload: descobrir pelo erro do Graph depois de subir 5 MB é o
    // pior desfecho.
    const gif = conferirArquivo({ mimetype: "image/gif", tamanho: 1000 });
    expect(gif.ok).toBe(false);
  });

  it("recusa arquivo acima do limite do tipo", () => {
    const grande = conferirArquivo({
      mimetype: "image/jpeg",
      tamanho: 6 * 1024 * 1024,
    });
    expect(grande.ok).toBe(false);
    if (!grande.ok) expect(grande.mensagem).toContain("5 MB");
  });

  it("recusa arquivo vazio", () => {
    expect(conferirArquivo({ mimetype: "image/png", tamanho: 0 }).ok).toBe(
      false,
    );
  });

  it("aceita documento de qualquer formato", () => {
    const planilha = conferirArquivo({
      mimetype: "application/vnd.ms-excel",
      tamanho: 200_000,
    });
    expect(planilha).toMatchObject({ ok: true, tipo: "document" });
  });
});

describe("envio", () => {
  it("sobe, envia e grava a mensagem com a chave do bucket", async () => {
    const resultado = await enviarMidia({
      organizationId: org.id,
      conversationId,
      arquivo: ARQUIVO,
      mimetype: "image/jpeg",
      fileName: "orcamento.jpg",
      legenda: "Segue o orçamento",
      autorId: dono.id,
    });

    expect(resultado.ok).toBe(true);
    expect(subir).toHaveBeenCalledTimes(1);
    // O id do upload é o que vai no envio: o bucket é privado, então mandar
    // `mediaUrl` não funcionaria.
    expect(enviar.mock.calls[0][0]).toMatchObject({
      mediaId: "meta-media-1",
      mediaKind: "image",
      caption: "Segue o orçamento",
    });

    const mensagem = await prisma.message.findFirstOrThrow({
      where: { conversationId, fromMe: true },
      select: {
        mediaKey: true,
        mediaType: true,
        mimetype: true,
        fileName: true,
        mediaCaption: true,
        status: true,
      },
    });
    expect(mensagem.mediaType).toBe("image");
    expect(mensagem.mimetype).toBe("image/jpeg");
    expect(mensagem.fileName).toBe("orcamento.jpg");
    expect(mensagem.mediaCaption).toBe("Segue o orçamento");
    expect(mensagem.mediaKey).toContain(org.id);
    expect(mensagem.status).toBe("SENT");
  });

  it("não sobe nada quando o arquivo já é recusado na conferência", async () => {
    const resultado = await enviarMidia({
      organizationId: org.id,
      conversationId,
      arquivo: ARQUIVO,
      mimetype: "image/gif",
      autorId: dono.id,
    });

    expect(resultado).toMatchObject({ ok: false, codigo: "ARQUIVO_RECUSADO" });
    expect(subir).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it("não grava mensagem quando o envio falha", async () => {
    enviar.mockRejectedValueOnce(new Error("Graph fora do ar"));

    const resultado = await enviarMidia({
      organizationId: org.id,
      conversationId,
      arquivo: ARQUIVO,
      mimetype: "image/png",
      autorId: dono.id,
    });

    expect(resultado.ok).toBe(false);
    // Uma bolha no banco que o cliente nunca recebeu é pior que um erro na
    // tela.
    const enviadas = await prisma.message.count({
      where: { conversationId, fromMe: true },
    });
    expect(enviadas).toBe(0);
  });

  it("a mensagem sai mesmo se o bucket falhar — sem a cópia, mas sai", async () => {
    guardar.mockRejectedValueOnce(new Error("S3 fora"));

    const resultado = await enviarMidia({
      organizationId: org.id,
      conversationId,
      arquivo: ARQUIVO,
      mimetype: "image/png",
      fileName: "foto.png",
      autorId: dono.id,
    });

    expect(resultado.ok).toBe(true);
    const mensagem = await prisma.message.findFirstOrThrow({
      where: { conversationId, fromMe: true },
      select: { mediaKey: true, fileName: true },
    });
    // O arquivo já chegou ao cliente: dizer que não saiu seria mentira.
    expect(mensagem.mediaKey).toBeNull();
    expect(mensagem.fileName).toBe("foto.png");
  });

  it("recusa quando a janela de 24 horas fechou", async () => {
    await prisma.crmLead.updateMany({
      where: { organizationId: org.id },
      data: { lastInboundAt: new Date(Date.now() - 25 * 60 * 60_000) },
    });

    const resultado = await enviarMidia({
      organizationId: org.id,
      conversationId,
      arquivo: ARQUIVO,
      mimetype: "image/png",
      autorId: dono.id,
    });

    expect(resultado).toMatchObject({ ok: false, codigo: "JANELA_FECHADA" });
    expect(subir).not.toHaveBeenCalled();
  });

  it("não envia por conversa de outra organização", async () => {
    const outraOrg = await createOrg("Vizinha");

    const resultado = await enviarMidia({
      organizationId: outraOrg.id,
      conversationId,
      arquivo: ARQUIVO,
      mimetype: "image/png",
      autorId: dono.id,
    });

    expect(resultado).toMatchObject({ ok: false, codigo: "SEM_TELEFONE" });
    expect(enviar).not.toHaveBeenCalled();
  });
});
