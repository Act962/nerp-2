import "server-only";

import type { BroadcastRecipientStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import type { CanonicalInboundStatusUpdate } from "@/features/whatsapp-chat/lib/providers/types";
import { recalcularContadores } from "./contadores";

/**
 * Aplica os avisos de entrega da Meta nos destinatários da campanha.
 *
 * Os mesmos avisos que atualizam os tiques do chat também dizem o que
 * aconteceu com cada mensagem de campanha — a diferença é só onde procurar o
 * `wamid`.
 *
 * A progressão é **monotônica**. A Meta não garante ordem, e um aviso de
 * "entregue" que chega depois do "lido" faria o relatório da campanha regredir
 * — número de leituras caindo sozinho é o tipo de coisa que destrói a
 * confiança no relatório inteiro.
 */

const PESO: Record<BroadcastRecipientStatus, number> = {
  PENDING: 0,
  SKIPPED: 0,
  FAILED: 0,
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

const DO_PROVEDOR: Record<
  CanonicalInboundStatusUpdate["status"],
  BroadcastRecipientStatus
> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

export async function aplicarStatusDeCampanha(
  atualizacoes: ReadonlyArray<CanonicalInboundStatusUpdate>,
  organizationId: string,
): Promise<{ aplicadas: number }> {
  if (atualizacoes.length === 0) return { aplicadas: 0 };

  const campanhasAfetadas = new Set<string>();
  let aplicadas = 0;

  for (const atualizacao of atualizacoes) {
    const novo = DO_PROVEDOR[atualizacao.status];
    if (!novo) continue;

    // O filtro pela organização não é redundante: `externalMessageId` é único
    // no banco inteiro, e sem ele um aviso forjado alcançaria a campanha de
    // outro tenant.
    const destinatario = await prisma.broadcastRecipient.findFirst({
      where: {
        externalMessageId: atualizacao.externalMessageId,
        broadcast: { organizationId },
      },
      select: { id: true, status: true, broadcastId: true },
    });
    if (!destinatario) continue;

    if (novo === "FAILED") {
      // Já lida não vira falha por aviso atrasado.
      if (destinatario.status === "READ") continue;
    } else if ((PESO[novo] ?? 0) <= (PESO[destinatario.status] ?? 0)) {
      continue;
    }

    await prisma.broadcastRecipient.update({
      where: { id: destinatario.id },
      data: {
        status: novo,
        ...(novo === "DELIVERED" ? { deliveredAt: atualizacao.at } : {}),
        ...(novo === "READ" ? { readAt: atualizacao.at } : {}),
        ...(novo === "FAILED"
          ? {
              errorCode: "DELIVERY_FAILED",
              errorMessage: atualizacao.errorReason ?? null,
            }
          : {}),
      },
    });

    campanhasAfetadas.add(destinatario.broadcastId);
    aplicadas += 1;
  }

  // Recalcula uma vez por campanha, não por destinatário.
  for (const broadcastId of campanhasAfetadas) {
    await recalcularContadores(broadcastId);
  }

  return { aplicadas };
}
