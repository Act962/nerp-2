import "server-only";

import { jornadaPorId } from "../catalogo";
import { tempoMinimoDaJornada } from "../lib/tempo";
import { emEstrelas } from "@/features/stars/lib/decimal";
import { creditar } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";
import {
  configDaJornada,
  JORNADAS_CONFIG_KEY,
  lerConfigDasJornadas,
} from "./config";

/**
 * Concluir uma jornada — e, quando for o caso, pagar por ela.
 *
 * Três coisas acontecem aqui, nesta ordem, e a ordem importa:
 *
 * 1. **O tempo é conferido contra o relógio do servidor.** `iniciadaEm` foi
 *    gravado por `jornadas.iniciar`; o cliente manda os tempos dele só para o
 *    admin ver depois onde o texto está longo. Confiar no relógio de quem quer
 *    a recompensa seria pedir para ser burlado.
 * 2. **A recompensa é reivindicada por índice parcial.** `stars_creditadas > 0`
 *    é único por (empresa, jornada) — dois colegas concluindo no mesmo segundo
 *    não creditam duas vezes, porque o banco recusa o segundo.
 * 3. **O crédito vem depois da reivindicação.** Se `creditar` falhar, a
 *    reivindicação é desfeita, e a jornada volta a poder ser paga.
 */

export type MotivoDaConclusao =
  | "creditada"
  | "ja_resgatada"
  | "jornada_sem_stars"
  | "org_nao_elegivel"
  | "ja_concluida";

export interface ResultadoDaConclusao {
  starsCreditadas: number;
  resgatadaPor: string | null;
  motivo: MotivoDaConclusao;
  saldo: number | null;
}

export class JornadaApressadaError extends Error {
  constructor(readonly faltamMs: number) {
    super("Jornada concluída rápido demais");
    this.name = "JornadaApressadaError";
  }
}

export class JornadaNaoIniciadaError extends Error {
  constructor() {
    super("Jornada não iniciada");
    this.name = "JornadaNaoIniciadaError";
  }
}

/** Quem já levou as ★ desta jornada nesta empresa. */
async function quemResgatou(
  organizationId: string,
  jornadaId: string,
): Promise<string | null> {
  const dono = await prisma.jornadaProgresso.findFirst({
    where: { organizationId, jornadaId, starsCreditadas: { gt: 0 } },
    select: { user: { select: { name: true } } },
  });
  return dono?.user.name ?? null;
}

export async function concluirJornada(input: {
  organizationId: string;
  userId: string;
  jornadaId: string;
  apressos: number;
  agora?: Date;
}): Promise<ResultadoDaConclusao> {
  const jornada = jornadaPorId(input.jornadaId);
  if (!jornada) throw new JornadaNaoIniciadaError();

  const agora = input.agora ?? new Date();
  const progresso = await prisma.jornadaProgresso.findUnique({
    where: {
      organizationId_userId_jornadaId: {
        organizationId: input.organizationId,
        userId: input.userId,
        jornadaId: input.jornadaId,
      },
    },
    select: { id: true, iniciadaEm: true, concluidaEm: true },
  });
  if (!progresso) throw new JornadaNaoIniciadaError();

  if (progresso.concluidaEm) {
    return {
      starsCreditadas: 0,
      resgatadaPor: await quemResgatou(input.organizationId, input.jornadaId),
      motivo: "ja_concluida",
      saldo: null,
    };
  }

  const minimo = tempoMinimoDaJornada(jornada);
  const decorrido = agora.getTime() - progresso.iniciadaEm.getTime();
  if (decorrido < minimo) throw new JornadaApressadaError(minimo - decorrido);

  await prisma.jornadaProgresso.update({
    where: { id: progresso.id },
    data: {
      concluidaEm: agora,
      apressos: input.apressos,
      passoAtual: jornada.passos.length,
    },
  });

  const [ajustes, org, user] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: JORNADAS_CONFIG_KEY } }),
    prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { verifiedAt: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { isAnonymous: true },
    }),
  ]);

  const config = lerConfigDasJornadas(ajustes?.value);
  const { stars, ativa } = configDaJornada(config, jornada);

  if (!ativa || stars <= 0) {
    return {
      starsCreditadas: 0,
      resgatadaPor: null,
      motivo: "jornada_sem_stars",
      saldo: null,
    };
  }

  // Duas travas contra torneira de saldo, e elas são diferentes:
  //
  // Conta provisória NUNCA leva ★ — ela se cria em um clique, e "conta
  // anônima + empresa nova" seria saldo de graça em série.
  //
  // Empresa de teste leva, salvo se o dono da plataforma desligar. Quem está
  // testando é justamente quem precisa aprender, e as ★ da sandbox só se
  // gastam dentro dela, que morre em 30 dias.
  const elegivel = user.isAnonymous
    ? false
    : org.verifiedAt !== null || config.recompensarSandbox;

  if (!elegivel) {
    return {
      starsCreditadas: 0,
      resgatadaPor: null,
      motivo: "org_nao_elegivel",
      saldo: null,
    };
  }

  // A reivindicação. Se outra pessoa desta empresa já concluiu, o índice
  // parcial recusa esta escrita — e é assim que "uma vez por empresa" se
  // sustenta mesmo com duas conclusões no mesmo instante.
  try {
    await prisma.jornadaProgresso.update({
      where: { id: progresso.id },
      data: { starsCreditadas: stars },
    });
  } catch {
    return {
      starsCreditadas: 0,
      resgatadaPor: await quemResgatou(input.organizationId, input.jornadaId),
      motivo: "ja_resgatada",
      saldo: null,
    };
  }

  try {
    const saldo = await creditar({
      organizationId: input.organizationId,
      valor: stars,
      tipo: "JORNADA_REWARD",
      descricao: `Jornada concluída: ${jornada.titulo}`,
      userId: input.userId,
    });
    return {
      starsCreditadas: stars,
      resgatadaPor: null,
      motivo: "creditada",
      saldo: emEstrelas(saldo),
    };
  } catch (erro) {
    // Devolver a reivindicação: sem isto, a empresa ficaria com a jornada
    // marcada como paga sem nunca ter recebido as ★.
    await prisma.jornadaProgresso.update({
      where: { id: progresso.id },
      data: { starsCreditadas: 0 },
    });
    throw erro;
  }
}
