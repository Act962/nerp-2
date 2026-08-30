import "server-only";

import { ORPCError } from "@orpc/server";
import type { StarTransactionType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

/**
 * Motor de débito de Stars.
 *
 * Duas coisas definem o comportamento:
 *
 * **A cobrança começa desligada.** Sem uma `StarRule` cadastrada para a ação —
 * ou com ela valendo zero — nada é debitado e nada é bloqueado. É o que
 * permite ligar a cobrança por organização, quando o negócio decidir, sem
 * mexer em código e sem quebrar quem já usa.
 *
 * **O débito é atômico e condicionado ao saldo.** O `updateMany` só acerta a
 * linha quando o saldo ainda comporta o valor; se duas mensagens saem ao mesmo
 * tempo com saldo para uma só, a segunda encontra zero linhas atualizadas e
 * falha — em vez de as duas lerem o mesmo saldo e deixarem a conta negativa.
 */

export interface ResultadoDoDebito {
  /** `false` quando não há regra ativa: seguiu sem cobrar. */
  readonly cobrado: boolean;
  readonly valor: number;
  readonly saldoDepois: number | null;
}

export class SaldoInsuficienteError extends ORPCError<
  "BAD_REQUEST",
  { code: string; necessario: number; saldo: number }
> {
  constructor(necessario: number, saldo: number) {
    super("BAD_REQUEST", {
      message: `Saldo de ★ insuficiente: são necessárias ${necessario} e há ${saldo}.`,
      data: { code: "SALDO_INSUFICIENTE", necessario, saldo },
    });
  }
}

/** Quanto custa uma ação nesta organização. `0` = não cobra. */
export async function custoDaAcao(
  organizationId: string,
  actionKey: string,
): Promise<number> {
  const regra = await prisma.starRule.findUnique({
    where: { organizationId_actionKey: { organizationId, actionKey } },
    select: { stars: true, isActive: true },
  });
  if (!regra || !regra.isActive) return 0;
  return Math.max(0, regra.stars);
}

/**
 * Cobra uma ação. Lança `SaldoInsuficienteError` quando há regra e falta saldo.
 *
 * Quem chama deve fazê-lo **depois** de garantir que a ação pode acontecer
 * (provedor resolvido, destinatário válido) e **antes** de executá-la — cobrar
 * depois do envio deixaria mensagem enviada sem cobrança quando o débito
 * falhasse; cobrar antes de saber se é possível enviar cobraria por mensagem
 * que não sai.
 */
export async function cobrarAcao(input: {
  organizationId: string;
  actionKey: string;
  descricao: string;
  userId?: string;
}): Promise<ResultadoDoDebito> {
  const valor = await custoDaAcao(input.organizationId, input.actionKey);
  if (valor === 0) return { cobrado: false, valor: 0, saldoDepois: null };

  // O `gte` no `where` é a trava: só debita quem ainda tem saldo, e a
  // concorrência é resolvida pelo banco, não por leitura seguida de escrita.
  const { count } = await prisma.organization.updateMany({
    where: { id: input.organizationId, starsBalance: { gte: valor } },
    data: { starsBalance: { decrement: valor } },
  });

  if (count === 0) {
    // Saldo insuficiente pode ser só o crédito do mês que ainda não entrou.
    // A conferência do ciclo mora AQUI, no caminho de falha, e não no começo
    // da função: no caminho feliz ela seria uma consulta a mais em toda
    // mensagem enviada, para quase sempre não fazer nada.
    const { garantirCreditoDoCiclo } = await import("./credito-do-ciclo");
    const ciclo = await garantirCreditoDoCiclo(input.organizationId);

    if (ciclo.creditou) {
      const segunda = await prisma.organization.updateMany({
        where: { id: input.organizationId, starsBalance: { gte: valor } },
        data: { starsBalance: { decrement: valor } },
      });
      if (segunda.count === 0) {
        const org = await prisma.organization.findUnique({
          where: { id: input.organizationId },
          select: { starsBalance: true },
        });
        throw new SaldoInsuficienteError(valor, org?.starsBalance ?? 0);
      }
    } else {
      const org = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { starsBalance: true },
      });
      throw new SaldoInsuficienteError(valor, org?.starsBalance ?? 0);
    }
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { starsBalance: true },
  });

  await prisma.starTransaction.create({
    data: {
      organizationId: input.organizationId,
      type: "APP_CHARGE",
      amount: -valor,
      balanceAfter: org.starsBalance,
      description: input.descricao,
      actionKey: input.actionKey,
      userId: input.userId ?? null,
    },
  });

  return { cobrado: true, valor, saldoDepois: org.starsBalance };
}

/**
 * Devolve o que foi cobrado.
 *
 * Existe para o caso de a ação falhar **depois** do débito. Um estorno é uma
 * linha nova no extrato, nunca a remoção da linha do débito: apagar história
 * financeira é como um extrato deixa de servir para auditoria.
 */
export async function estornar(input: {
  organizationId: string;
  valor: number;
  descricao: string;
  actionKey?: string;
  userId?: string;
}): Promise<void> {
  if (input.valor <= 0) return;

  const org = await prisma.organization.update({
    where: { id: input.organizationId },
    data: { starsBalance: { increment: input.valor } },
    select: { starsBalance: true },
  });

  await prisma.starTransaction.create({
    data: {
      organizationId: input.organizationId,
      type: "REFUND",
      amount: input.valor,
      balanceAfter: org.starsBalance,
      description: input.descricao,
      actionKey: input.actionKey ?? null,
      userId: input.userId ?? null,
    },
  });
}

/** Credita saldo — recarga, cortesia, crédito de plano. */
export async function creditar(input: {
  organizationId: string;
  valor: number;
  tipo: StarTransactionType;
  descricao: string;
  userId?: string;
}): Promise<number> {
  if (input.valor <= 0) throw new Error("Crédito precisa ser positivo");

  const org = await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      starsBalance: { increment: input.valor },
      // Primeiro crédito marca o início do ciclo.
      ...(input.tipo === "PLAN_CREDIT" ? { starsCycleStart: new Date() } : {}),
    },
    select: { starsBalance: true },
  });

  await prisma.starTransaction.create({
    data: {
      organizationId: input.organizationId,
      type: input.tipo,
      amount: input.valor,
      balanceAfter: org.starsBalance,
      description: input.descricao,
      userId: input.userId ?? null,
    },
  });

  return org.starsBalance;
}

/**
 * Chaves de ação usadas hoje.
 *
 * Reexportadas de `lib/acoes-chaves`, que não é `server-only`: a tela de preços
 * roda no cliente e precisa das mesmas chaves. Quem já importa daqui continua
 * funcionando.
 */
export { ACOES } from "../lib/acoes-chaves";
