import "server-only";

import prisma from "@/lib/db";

/**
 * O teto de conversa por dia, por organização.
 *
 * É a última trava da fatura, e existe porque as outras não cobrem o mesmo
 * caso: o saldo de ★ para quando a cobrança está ligada, e o limite por sessão
 * só impede uma conversa longa — nada impede abrir cem conversas curtas. Este
 * conta as mensagens de TODAS as sessões da organização nas últimas 24 horas.
 *
 * Zero desliga. É o padrão: quem não configurou não deve descobrir um limite
 * no meio de um dia movimentado.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type VereditoDoTeto =
  | { ok: true }
  | { ok: false; usadas: number; teto: number };

export async function conferirTetoDiario(
  organizationId: string,
  teto: number,
  agora = new Date(),
): Promise<VereditoDoTeto> {
  if (teto <= 0) return { ok: true };

  const desde = new Date(agora.getTime() - DIA_MS);
  const soma = await prisma.siteChatSession.aggregate({
    where: {
      organizationId,
      channel: "APP",
      createdAt: { gte: desde },
    },
    _sum: { messageCount: true },
  });

  const usadas = soma._sum.messageCount ?? 0;
  return usadas >= teto ? { ok: false, usadas, teto } : { ok: true };
}
