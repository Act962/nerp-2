import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { avaliarAvisosDaOrg } from "./avaliar-org";
import type { CandidatoAAviso } from "./tipos";

/**
 * A gravação dos avisos, separada da avaliação.
 *
 * `skipDuplicates` mais o índice único `(organization_id, dedupe_key)` é o que
 * permite o cron rodar três vezes ao dia sem transformar um estoque baixo em
 * três avisos iguais. A chave carrega a data: amanhã o mesmo problema vira um
 * aviso novo, que é o comportamento certo — o problema continua de pé.
 */

/** Quantos dias de aviso ficam guardados. Depois disso, o passado não ajuda. */
export const DIAS_DE_HISTORICO = 45;

export async function gravarAvisos(
  organizationId: string,
  candidatos: readonly CandidatoAAviso[],
): Promise<number> {
  if (candidatos.length === 0) return 0;

  const { count } = await prisma.astroAviso.createMany({
    data: candidatos.map((candidato) => ({
      organizationId,
      tipo: candidato.tipo,
      severidade: candidato.severidade,
      titulo: candidato.titulo,
      corpo: candidato.corpo,
      dados: (candidato.dados ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      dedupeKey: candidato.dedupeKey,
    })),
    skipDuplicates: true,
  });

  return count;
}

/** Avaliar e gravar, que é o que o cron faz por organização. */
export async function avaliarEGravar(
  organizationId: string,
  agora = new Date(),
): Promise<number> {
  const candidatos = await avaliarAvisosDaOrg(organizationId, agora);
  return gravarAvisos(organizationId, candidatos);
}

/**
 * Quais organizações valem uma passada.
 *
 * Verificadas, ou sandbox com acesso recente. Avaliar a operação de uma
 * empresa de teste abandonada há três semanas é gastar consulta para ninguém
 * ler — e são justamente as que estão perto de expirar.
 */
export async function organizacoesParaAvaliar(
  agora = new Date(),
): Promise<string[]> {
  const corte = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { verifiedAt: { not: null } },
        { verifiedAt: null, lastAccessAt: { gte: corte } },
      ],
    },
    select: { id: true },
  });
  return orgs.map((org) => org.id);
}

/** Limpa o que já não ajuda ninguém: aviso lido e velho. */
export async function limparAvisosAntigos(agora = new Date()): Promise<number> {
  const corte = new Date(
    agora.getTime() - DIAS_DE_HISTORICO * 24 * 60 * 60 * 1000,
  );
  const { count } = await prisma.astroAviso.deleteMany({
    where: { createdAt: { lt: corte } },
  });
  return count;
}
