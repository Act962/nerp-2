import "server-only";

import prisma from "@/lib/db";
import { conversationChannel, funnelChannel } from "@/lib/realtime/channels";
import { realtimePublisher } from "@/lib/realtime/publisher";

/**
 * A janela de atendimento da Meta: só dá para mandar texto livre até 24 horas
 * depois da última mensagem do cliente. Fora dela, só template aprovado.
 *
 * Lead que nunca falou conosco não tem janela aberta — a primeira abordagem
 * também precisa de template.
 */
const JANELA_MS = 24 * 60 * 60 * 1000;

export function janelaDeAtendimentoAberta(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < JANELA_MS;
}

/**
 * Grava a mensagem que acabou de sair e atualiza o que depende dela.
 *
 * Roda **depois** de o provedor confirmar o envio: uma bolha no banco que o
 * cliente nunca recebeu é pior que um erro na tela.
 *
 * `seen: true` porque a mensagem é nossa — o contador de não-lidas conta o que
 * o cliente mandou e o atendente ainda não abriu, e a própria resposta do
 * atendente nunca deve aparecer como pendente.
 */
export async function registrarSaida(input: {
  organizationId: string;
  funnelId: string;
  conversationId: string;
  leadId: string;
  externalMessageId: string;
  corpo: string;
  respondeA?: string;
  autorId: string;
  primeiraResposta: boolean;
  estavaEsperando: boolean;
  /** Preenchido quando a mensagem é um arquivo, não texto. */
  midia?: {
    /** `null` quando a gravação no bucket falhou — a mensagem saiu mesmo assim. */
    mediaKey: string | null;
    mediaType: string;
    mimetype: string;
    fileName: string | null;
    caption: string | null;
  };
}): Promise<{ id: string; createdAt: Date }> {
  const respondida = input.respondeA
    ? await prisma.message.findFirst({
        where: {
          externalMessageId: input.respondeA,
          organizationId: input.organizationId,
        },
        select: { id: true },
      })
    : null;

  const agora = new Date();

  const mensagem = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      externalMessageId: input.externalMessageId,
      body: input.corpo,
      fromMe: true,
      ...(input.midia
        ? {
            mediaKey: input.midia.mediaKey,
            mediaType: input.midia.mediaType,
            mediaCaption: input.midia.caption,
            mimetype: input.midia.mimetype,
            fileName: input.midia.fileName,
          }
        : {}),
      // Saiu daqui: um tique. Entregue e lido chegam depois, pelo webhook.
      status: "SENT",
      seen: true,
      senderId: input.autorId,
      quotedMessageId: respondida?.id ?? null,
      createdAt: agora,
    },
    select: { id: true, createdAt: true },
  });

  try {
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageId: mensagem.id, isActive: true },
      }),
      prisma.crmLead.update({
        where: { id: input.leadId },
        data: {
          lastOutboundAt: agora,
          // O tempo de primeira resposta é métrica de atendimento: só marca
          // uma vez, na primeira vez que alguém respondeu este lead.
          ...(input.primeiraResposta ? { firstResponseAt: agora } : {}),
          // Estava esperando resposta e acabou de ser respondido.
          ...(input.estavaEsperando ? { statusFlow: "ACTIVE" as const } : {}),
        },
      }),
    ]);
  } catch (error) {
    console.error("[whatsapp:outbound] atualizacao_de_marcos_falhou", error);
  }

  try {
    const evento = {
      messageId: mensagem.id,
      conversationId: input.conversationId,
      leadId: input.leadId,
      // Quem enviou: a tela ignora o eco da própria mensagem, que já apareceu
      // de forma otimista no momento do clique.
      autorId: input.autorId,
    };
    await realtimePublisher.publish(
      conversationChannel(input.conversationId),
      "message:created",
      evento,
    );
    await realtimePublisher.publish(
      funnelChannel(input.funnelId),
      "message:created",
      evento,
    );
  } catch (error) {
    console.error("[whatsapp:outbound] realtime_falhou", error);
  }

  return mensagem;
}
