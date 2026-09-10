import "server-only";

import { exigirContaVerificada } from "@/lib/conta-verificada";
import prisma from "@/lib/db";
import { campanhaDisparoSolicitado, inngest } from "@/lib/inngest/client";
import { modoDemoLigado } from "@/features/whatsapp-chat/lib/providers";

/**
 * A reivindicação e o disparo de uma campanha.
 *
 * Saiu do procedure para ser chamada também pelo Astro. A regra que importa
 * continua sendo o `updateMany` **condicionado ao status**: dois cliques
 * rápidos, ou o clique junto do pedido pela conversa, e só um encontra a
 * campanha parada — o outro atualiza zero linhas e para aqui, sem ter enviado
 * nada.
 */

export class DisparoRecusadoError extends Error {}

export async function dispararCampanha(input: {
  broadcastId: string;
  organizationId: string;
}): Promise<{ disparando: true; destinatarios: number }> {
  const { broadcastId, organizationId } = input;

  await exigirContaVerificada(organizationId, "disparar uma campanha");

  const campanha = await prisma.broadcast.findFirst({
    where: { id: broadcastId, organizationId },
    select: {
      id: true,
      funnelId: true,
      status: true,
      templateName: true,
      templateLanguage: true,
    },
  });
  if (!campanha) {
    throw new DisparoRecusadoError("Campanha não encontrada.");
  }

  if (!campanha.templateName || !campanha.templateLanguage) {
    throw new DisparoRecusadoError(
      "Escolha um template aprovado antes de disparar.",
    );
  }

  const pendentes = await prisma.broadcastRecipient.count({
    where: { broadcastId: campanha.id, status: "PENDING" },
  });
  if (pendentes === 0) {
    throw new DisparoRecusadoError(
      "A campanha não tem destinatários pendentes.",
    );
  }

  // Sem número conectado não há de onde a mensagem sair. No modo demo o
  // provedor é dublado, então a checagem não se aplica.
  if (!modoDemoLigado()) {
    const conexao = await prisma.whatsAppConnection.findFirst({
      where: { funnelId: campanha.funnelId, organizationId },
      select: { id: true },
    });
    if (!conexao) {
      throw new DisparoRecusadoError(
        "O funil desta campanha não tem número de WhatsApp conectado.",
      );
    }
  }

  const { count } = await prisma.broadcast.updateMany({
    where: {
      id: campanha.id,
      organizationId,
      status: { in: ["DRAFT", "SCHEDULED"] },
    },
    data: { status: "SENDING", startedAt: new Date() },
  });
  if (count === 0) {
    throw new DisparoRecusadoError(
      "Esta campanha já está disparando ou já foi enviada.",
    );
  }

  // Publicar pode falhar (fila fora do ar). Se falhar depois da reivindicação,
  // a campanha ficaria presa em "disparando" para sempre — ninguém a
  // processaria, e uma nova tentativa esbarraria na própria reivindicação.
  try {
    await inngest.send(
      campanhaDisparoSolicitado.create({
        broadcastId: campanha.id,
        organizationId,
        funnelId: campanha.funnelId,
      }),
    );
  } catch (erro) {
    await prisma.broadcast.updateMany({
      where: { id: campanha.id, organizationId, status: "SENDING" },
      data: { status: campanha.status, startedAt: null },
    });
    console.error("[campanha] falha ao publicar o disparo", {
      broadcastId: campanha.id,
      erro,
    });
    throw new DisparoRecusadoError(
      "Não foi possível agendar o disparo: a fila de tarefas não respondeu. A campanha continua como estava — tente de novo depois.",
    );
  }

  return { disparando: true, destinatarios: pendentes };
}
