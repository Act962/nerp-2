import "server-only";

import type { MessageStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { conversationChannel } from "@/lib/realtime/channels";
import { realtimePublisher } from "@/lib/realtime/publisher";
import type { CanonicalInboundStatusUpdate } from "../providers/types";

/**
 * Aplica os avisos de entrega e leitura nas mensagens que **nós** enviamos —
 * são os tiques que o atendente vê na própria bolha.
 *
 * A progressão é **monotônica**: a Meta não garante ordem, e um aviso de
 * "entregue" que chega depois do "lido" não pode fazer o tique azul voltar a
 * cinza. Por isso comparamos o peso antes de gravar.
 *
 * `FAILED` é exceção deliberada: falha só sobrescreve enquanto a mensagem não
 * foi lida. Uma mensagem que o cliente já leu não vira "falhou" por causa de
 * um aviso atrasado.
 */

const PESO: Record<MessageStatus, number> = {
  FAILED: 0,
  SENT: 1,
  DELIVERED: 2,
  SEEN: 3,
  DELETED: 4,
};

const DO_PROVEDOR: Record<
  CanonicalInboundStatusUpdate["status"],
  MessageStatus
> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "SEEN",
  failed: "FAILED",
};

export async function applyStatusUpdates(
  atualizacoes: ReadonlyArray<CanonicalInboundStatusUpdate>,
  organizationId: string,
): Promise<{ aplicadas: number }> {
  if (atualizacoes.length === 0) return { aplicadas: 0 };

  let aplicadas = 0;

  for (const atualizacao of atualizacoes) {
    const novo = DO_PROVEDOR[atualizacao.status];
    if (!novo) continue;

    // O filtro por organização não é decoração: `externalMessageId` é único
    // globalmente, e sem ele um aviso forjado alcançaria mensagem de outro
    // tenant.
    const mensagem = await prisma.message.findFirst({
      where: {
        externalMessageId: atualizacao.externalMessageId,
        organizationId,
      },
      select: { id: true, status: true, conversationId: true },
    });
    if (!mensagem) continue;

    const atual = PESO[mensagem.status] ?? 0;
    const proposto = PESO[novo] ?? 0;

    if (novo === "FAILED") {
      // Já lida não vira falha.
      if (mensagem.status === "SEEN" || mensagem.status === "DELETED") continue;
    } else if (proposto <= atual) {
      continue;
    }

    await prisma.message.update({
      where: { id: mensagem.id },
      data: { status: novo },
    });
    aplicadas += 1;

    await realtimePublisher.publish(
      conversationChannel(mensagem.conversationId),
      "message:updated",
      { messageId: mensagem.id, status: novo },
    );
  }

  return { aplicadas };
}
