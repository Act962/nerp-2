import "server-only";

import prisma from "@/lib/db";

/**
 * Recalcula os contadores de uma campanha a partir dos destinatários.
 *
 * **Recalcula, nunca incrementa.** Incremento erra em dois cenários que
 * acontecem sempre no mundo real: o job repetir um lote depois de uma falha, e
 * a Meta reentregar o mesmo aviso de entrega. Somar de novo nesses casos
 * inflaria os números e a campanha apareceria com mais entregas do que
 * destinatários.
 *
 * Contar é uma consulta agregada por status — barato o suficiente para rodar
 * ao fim de cada lote.
 */
export async function recalcularContadores(broadcastId: string): Promise<void> {
  const porStatus = await prisma.broadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId },
    _count: { _all: true },
  });

  const quantos = (status: string) =>
    porStatus.find((linha) => linha.status === status)?._count._all ?? 0;

  const total = porStatus.reduce((soma, linha) => soma + linha._count._all, 0);

  // "Enviadas" acumula tudo que saiu: entregue e lido também saíram. Sem isso,
  // o número cairia conforme os avisos de entrega chegassem.
  const enviadas = quantos("SENT") + quantos("DELIVERED") + quantos("READ");
  const entregues = quantos("DELIVERED") + quantos("READ");

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      totalRecipients: total,
      sentCount: enviadas,
      deliveredCount: entregues,
      readCount: quantos("READ"),
      failedCount: quantos("FAILED"),
    },
  });
}
