import "server-only";

import { JORNADAS } from "@/features/jornadas/catalogo";
import { emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";

/**
 * Como as jornadas guiadas estão indo, em todas as empresas.
 *
 * **Lê ATRAVÉS das organizações, de propósito** — mesma exceção consciente de
 * `painel-das-empresas.ts`, e pelo mesmo motivo: quem chama é o administrador
 * da plataforma, pela guarda `requireSiteAdminMiddleware`, e não há empresa
 * ativa no contexto. As consultas cross-org ficam reunidas em arquivos como
 * este para que um `findMany` sem `organizationId` continue sendo um bug em
 * qualquer outro lugar do sistema.
 *
 * É o que responde "qual jornada as pessoas abandonam?" — e `apressosMedio`
 * responde "em qual delas o texto está longo demais", que é a pergunta que faz
 * a jornada melhorar em vez de só existir.
 */

export interface NumerosDaJornada {
  jornadaId: string;
  /** Pessoas que chegaram ao fim. */
  concluintes: number;
  /** Pessoas que começaram e ainda não terminaram. */
  emAndamento: number;
  /** Empresas que já receberam as ★ desta jornada. */
  empresasRecompensadas: number;
  starsPagas: number;
  apressosMedio: number;
}

export async function numerosDasJornadas(): Promise<
  Map<string, NumerosDaJornada>
> {
  const ids = JORNADAS.map((jornada) => jornada.id);

  const [concluidos, emAndamento, recompensadas] = await Promise.all([
    prisma.jornadaProgresso.groupBy({
      by: ["jornadaId"],
      where: { jornadaId: { in: ids }, concluidaEm: { not: null } },
      _count: { _all: true },
      _avg: { apressos: true },
    }),
    prisma.jornadaProgresso.groupBy({
      by: ["jornadaId"],
      where: { jornadaId: { in: ids }, concluidaEm: null },
      _count: { _all: true },
    }),
    prisma.jornadaProgresso.groupBy({
      by: ["jornadaId"],
      where: { jornadaId: { in: ids }, starsCreditadas: { gt: 0 } },
      _count: { _all: true },
      _sum: { starsCreditadas: true },
    }),
  ]);

  // Casados em memória: um `include` por jornada faria uma consulta por linha,
  // e são três agregações sobre a mesma tabela.
  const porId = new Map<string, NumerosDaJornada>(
    ids.map((jornadaId) => [
      jornadaId,
      {
        jornadaId,
        concluintes: 0,
        emAndamento: 0,
        empresasRecompensadas: 0,
        starsPagas: 0,
        apressosMedio: 0,
      },
    ]),
  );

  for (const linha of concluidos) {
    const alvo = porId.get(linha.jornadaId);
    if (!alvo) continue;
    alvo.concluintes = linha._count._all;
    alvo.apressosMedio = Math.round((linha._avg.apressos ?? 0) * 10) / 10;
  }
  for (const linha of emAndamento) {
    const alvo = porId.get(linha.jornadaId);
    if (!alvo) continue;
    alvo.emAndamento = linha._count._all;
  }
  for (const linha of recompensadas) {
    const alvo = porId.get(linha.jornadaId);
    if (!alvo) continue;
    // Uma linha com ★ por empresa é o que o índice parcial garante, então
    // contar linhas é contar empresas.
    alvo.empresasRecompensadas = linha._count._all;
    alvo.starsPagas = emEstrelas(linha._sum.starsCreditadas);
  }

  return porId;
}
