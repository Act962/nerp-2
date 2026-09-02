import "server-only";

import { dispararAutomacoes } from "@/features/automacoes/server/disparar";
import { acharClientePeloTelefone } from "@/features/crm/server/casar-cliente";
import prisma from "@/lib/db";
import { conversationChannel, funnelChannel } from "@/lib/realtime/channels";
import { realtimePublisher } from "@/lib/realtime/publisher";
import type {
  CanonicalInboundMedia,
  CanonicalInboundMessage,
} from "../providers/types";
import type { EstrategiaDeMidia } from "./meta-media-strategy";

/**
 * Porta de entrada única de toda mensagem recebida.
 *
 * O adapter normaliza o payload do provedor e chama esta função. Ela **não
 * conhece provedor**: o que é específico entra como estratégia injetada (hoje,
 * só o download da mídia). É o que permite acrescentar um segundo provedor
 * depois sem tocar aqui.
 *
 * Invariantes que não podem quebrar — cada um existe por um bug que já
 * aconteceu no projeto de origem:
 *
 *  - **Idempotência é `upsert` por `externalMessageId`.** A Meta reentrega o
 *    mesmo evento em qualquer resposta 5xx. Com `create`, a bolha duplica na
 *    conversa.
 *  - **`status` e `seen` são coisas diferentes.** A mensagem recebida nasce
 *    `status: SEEN` (o provedor confirmou a entrega para nós) e `seen: false`
 *    (o atendente ainda não abriu). Mexer num sem o outro quebra o contador de
 *    não-lidas em silêncio.
 *  - **`externalMessageId` vazio não é gravado.** A coluna é única: gravar
 *    string vazia colidiria na próxima ocorrência, e apagar por id vazio
 *    atingiria a mensagem errada.
 *  - **Efeito colateral é best-effort.** Falha de realtime não pode derrubar
 *    uma mensagem já gravada.
 */

export interface ContextoInbound {
  readonly organizationId: string;
  readonly funnelId: string;
  /** Injetada pelo webhook; ausente = grava a mídia sem o arquivo. */
  readonly baixarMidia?: EstrategiaDeMidia;
}

export type ResultadoInbound =
  | {
      ok: true;
      messageId: string;
      leadId: string;
      conversationId: string;
      leadCriado: boolean;
    }
  | { ok: true; ignorado: string }
  | { ok: false; motivo: string };

export async function persistInboundMessage(
  canonical: CanonicalInboundMessage,
  ctx: ContextoInbound,
): Promise<ResultadoInbound> {
  if (!canonical.externalMessageId) {
    console.warn("[whatsapp:inbound] id_externo_vazio", {
      funnelId: ctx.funnelId,
      tipo: canonical.type,
    });
    return { ok: true, ignorado: "id_externo_vazio" };
  }

  // Reação e tipo desconhecido não viram bolha. O desconhecido é registrado
  // com o nome que a Meta usou, para aparecer no log quando ela lançar um
  // tipo novo — sem isso a mensagem some sem deixar rastro.
  if (canonical.type === "reaction") return { ok: true, ignorado: "reacao" };
  if (canonical.type === "unsupported") {
    console.info("[whatsapp:inbound] tipo_nao_suportado", {
      providerType: canonical.providerType,
    });
    return {
      ok: true,
      ignorado: `nao_suportado:${canonical.providerType ?? "desconhecido"}`,
    };
  }

  const telefone = canonical.sender.phone;
  const { organizationId, funnelId } = ctx;

  const existente = await prisma.crmLead.findUnique({
    where: { phone_funnelId: { phone: telefone, funnelId } },
    select: {
      id: true,
      statusFlow: true,
      conversation: { select: { id: true } },
    },
  });

  let leadId: string;
  let conversationId: string;
  let leadCriado = false;

  if (existente) {
    leadId = existente.id;

    conversationId =
      existente.conversation?.id ??
      (
        await prisma.conversation.create({
          data: {
            organizationId,
            funnelId,
            leadId: existente.id,
            remoteJid: telefone,
          },
          select: { id: true },
        })
      ).id;

    // Cliente que voltou a falar depois de encerrado reabre o atendimento —
    // senão a conversa continuaria escondida no filtro "Finalizados".
    if (existente.statusFlow === "FINISHED") {
      await prisma.crmLead.update({
        where: { id: existente.id },
        data: { statusFlow: "ACTIVE" },
      });
    }
  } else {
    const criado = await criarLeadDoInbound(canonical, ctx);
    if (!criado) return { ok: false, motivo: "sem_estagio_no_funil" };
    leadId = criado.leadId;
    conversationId = criado.conversationId;
    leadCriado = true;
  }

  // Resposta a uma mensagem anterior: guardamos o id interno, não o externo.
  const respondida = canonical.replyToExternalMessageId
    ? await prisma.message.findUnique({
        where: { externalMessageId: canonical.replyToExternalMessageId },
        select: { id: true },
      })
    : null;

  const comum = {
    organizationId,
    conversationId,
    externalMessageId: canonical.externalMessageId,
    fromMe: canonical.sender.fromMe,
    senderId: canonical.sender.phone,
    senderName: canonical.sender.displayName?.trim() || null,
    quotedMessageId: respondida?.id ?? null,
    // Recebida: já entregue para nós (`SEEN`), ainda não aberta pelo
    // atendente (`seen: false`). São coisas diferentes de propósito.
    status: "SEEN" as const,
    seen: false,
    createdAt: canonical.sentAt,
  };

  let mensagem: { id: string } | null = null;

  switch (canonical.type) {
    case "text":
      mensagem = await prisma.message.upsert({
        where: { externalMessageId: canonical.externalMessageId },
        // Reentrega não pode sobrescrever nada: a linha já está correta.
        update: {},
        create: { ...comum, body: canonical.body },
        select: { id: true },
      });
      break;

    case "media": {
      const midia = await baixarMidiaComTolerancia(
        canonical,
        ctx,
        conversationId,
      );
      mensagem = await prisma.message.upsert({
        where: { externalMessageId: canonical.externalMessageId },
        update: {},
        create: {
          ...comum,
          body: canonical.caption ?? null,
          mediaKey: midia?.key ?? null,
          mediaType: canonical.kind,
          mediaCaption: canonical.caption ?? null,
          mimetype: midia?.mimetype ?? canonical.mimetype ?? null,
          fileName: canonical.fileName ?? null,
        },
        select: { id: true },
      });
      break;
    }

    case "location":
      mensagem = await prisma.message.upsert({
        where: { externalMessageId: canonical.externalMessageId },
        update: {},
        create: {
          ...comum,
          body: canonical.name ?? canonical.address ?? null,
          latitude: canonical.latitude,
          longitude: canonical.longitude,
        },
        select: { id: true },
      });
      break;

    case "contact":
      mensagem = await prisma.message.upsert({
        where: { externalMessageId: canonical.externalMessageId },
        update: {},
        create: {
          ...comum,
          body: canonical.contactName,
          metadata: {
            contactName: canonical.contactName,
            contactPhone: canonical.contactPhone,
          },
        },
        select: { id: true },
      });
      break;

    case "interactive_reply":
      mensagem = await prisma.message.upsert({
        where: { externalMessageId: canonical.externalMessageId },
        update: {},
        create: {
          ...comum,
          body: canonical.replyText ?? "",
          metadata: { replyId: canonical.replyId ?? null },
        },
        select: { id: true },
      });
      break;
  }

  if (!mensagem)
    return { ok: true, ignorado: `nao_persistida:${canonical.type}` };

  await depoisDeReceber({
    ctx,
    leadId,
    conversationId,
    messageId: mensagem.id,
    canonical,
    leadCriado,
  });

  return {
    ok: true,
    messageId: mensagem.id,
    leadId,
    conversationId,
    leadCriado,
  };
}

/**
 * Cria o lead e a conversa de um número que ainda não conhecíamos.
 *
 * Devolve `null` quando o funil não tem nenhum estágio: sem coluna onde
 * pousar, o card não existiria. É por isso que criar funil semeia estágios na
 * mesma transação.
 */
async function criarLeadDoInbound(
  canonical: CanonicalInboundMessage,
  ctx: ContextoInbound,
): Promise<{ leadId: string; conversationId: string } | null> {
  const primeiroEstagio = await prisma.crmStage.findFirst({
    where: { funnelId: ctx.funnelId, organizationId: ctx.organizationId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (!primeiroEstagio) {
    console.error("[whatsapp:inbound] funil_sem_estagio", {
      funnelId: ctx.funnelId,
    });
    return null;
  }

  const customerId = await acharClientePeloTelefone(
    canonical.sender.phone,
    ctx.organizationId,
  );

  return prisma.$transaction(async (tx) => {
    const lead = await tx.crmLead.create({
      data: {
        organizationId: ctx.organizationId,
        funnelId: ctx.funnelId,
        stageId: primeiroEstagio.id,
        customerId,
        name: canonical.sender.displayName?.trim() || canonical.sender.phone,
        phone: canonical.sender.phone,
        source: "WHATSAPP",
        // Chegou e ninguém respondeu ainda — é o que a caixa de entrada usa
        // para destacar quem está esperando.
        statusFlow: "WAITING",
        lastInboundAt: canonical.sentAt,
      },
      select: { id: true },
    });

    const conversa = await tx.conversation.create({
      data: {
        organizationId: ctx.organizationId,
        funnelId: ctx.funnelId,
        leadId: lead.id,
        remoteJid: canonical.sender.phone,
        name: canonical.sender.displayName?.trim() || null,
      },
      select: { id: true },
    });

    return { leadId: lead.id, conversationId: conversa.id };
  });
}

async function baixarMidiaComTolerancia(
  canonical: CanonicalInboundMedia,
  ctx: ContextoInbound,
  conversationId: string,
): Promise<{ key: string; mimetype: string } | null> {
  if (!ctx.baixarMidia) return null;
  try {
    return await ctx.baixarMidia(canonical, conversationId);
  } catch (error) {
    // Persiste sem o arquivo em vez de perder a mensagem: o texto da legenda,
    // o tipo e o id continuam servindo, e o operador vê que algo chegou.
    console.error("[whatsapp:inbound] download_de_midia_falhou", {
      externalMessageId: canonical.externalMessageId,
      error,
    });
    return null;
  }
}

/**
 * Efeitos posteriores ao gravar. Cada um em `try/catch` próprio: nenhum deles
 * pode derrubar uma mensagem que já está no banco.
 */
async function depoisDeReceber(input: {
  ctx: ContextoInbound;
  leadId: string;
  conversationId: string;
  messageId: string;
  canonical: CanonicalInboundMessage;
  leadCriado: boolean;
}): Promise<void> {
  const { ctx, leadId, conversationId, messageId, canonical, leadCriado } =
    input;

  try {
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageId: messageId, isActive: true },
      }),
      prisma.crmLead.update({
        where: { id: leadId },
        data: { lastInboundAt: canonical.sentAt },
      }),
    ]);
  } catch (error) {
    console.error("[whatsapp:inbound] atualizacao_de_marcos_falhou", error);
  }

  try {
    const evento = {
      messageId,
      conversationId,
      leadId,
      funnelId: ctx.funnelId,
      tipo: canonical.type,
      recebidaEm: canonical.sentAt.toISOString(),
    };
    await realtimePublisher.publish(
      conversationChannel(conversationId),
      "message:new",
      evento,
    );
    await realtimePublisher.publish(
      funnelChannel(ctx.funnelId),
      leadCriado ? "conversation:new" : "message:new",
      evento,
    );
  } catch (error) {
    console.error("[whatsapp:inbound] realtime_falhou", error);
  }

  // Automações por último, e sem poder derrubar nada: a mensagem já está
  // gravada e já apareceu na tela. `dispararAutomacoes` não lança — o que ela
  // faz de errado vira log e linha de execução falha, nunca um webhook com
  // erro que a Meta vai reentregar.
  //
  // Lead novo dispara os dois gatilhos: quem automatiza "primeiro contato"
  // espera rodar, e quem automatiza "toda mensagem" também.
  if (leadCriado) {
    await dispararAutomacoes({
      organizationId: ctx.organizationId,
      funnelId: ctx.funnelId,
      leadId,
      gatilho: "TRIGGER_NEW_LEAD",
      textoDaMensagem: textoDaMensagem(canonical),
    });
  }

  await dispararAutomacoes({
    organizationId: ctx.organizationId,
    funnelId: ctx.funnelId,
    leadId,
    gatilho: "TRIGGER_MESSAGE_IN",
    textoDaMensagem: textoDaMensagem(canonical),
  });
}

/** O texto que o filtro de automação enxerga. Mídia sem legenda não tem. */
function textoDaMensagem(canonical: CanonicalInboundMessage): string | null {
  if (canonical.type === "text") return canonical.body;
  return "caption" in canonical ? (canonical.caption ?? null) : null;
}
