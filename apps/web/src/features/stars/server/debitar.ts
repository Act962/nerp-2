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
 * A organização consegue pagar `valor` ★ agora?
 *
 * Existe para quem é obrigado a executar a ação **antes** de cobrar — hoje só
 * o disparo de campanha, que precisa dessa ordem para a repetição de um lote
 * não cobrar duas vezes pela mesma mensagem. Nessa ordem invertida, descobrir
 * a falta de saldo pelo `SaldoInsuficienteError` é tarde demais: a mensagem já
 * saiu e já deixou de estar `PENDING`, então nenhuma rodada seguinte a alcança
 * para cobrar.
 *
 * Confere o crédito do ciclo antes de dizer não, pelo mesmo motivo que
 * `cobrarAcao` confere no caminho de falha: saldo zerado na virada do mês
 * costuma ser só o crédito do plano que ainda não entrou.
 *
 * **Não reserva nada.** Entre o `true` daqui e o débito ainda cabe outro envio
 * concorrente, então quem chama precisa tratar a cobrança que falha mesmo
 * assim — é raro, mas é dinheiro.
 */
export async function podePagar(
  organizationId: string,
  valor: number,
): Promise<boolean> {
  if (valor <= 0) return true;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { starsBalance: true },
  });
  if (!org) return false;
  if (org.starsBalance >= valor) return true;

  const { garantirCreditoDoCiclo } = await import("./credito-do-ciclo");
  if (!(await garantirCreditoDoCiclo(organizationId)).creditou) return false;

  const depois = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { starsBalance: true },
  });
  return (depois?.starsBalance ?? 0) >= valor;
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

  const saldoDepois = await debitarComExtrato(input, valor);
  if (saldoDepois !== null) {
    return { cobrado: true, valor, saldoDepois };
  }

  // Saldo insuficiente pode ser só o crédito do mês que ainda não entrou. A
  // conferência do ciclo mora AQUI, no caminho de falha, e não no começo da
  // função: no caminho feliz ela seria uma consulta a mais em toda mensagem
  // enviada, para quase sempre não fazer nada.
  //
  // E mora **fora** da transação do débito de propósito: ela escreve na mesma
  // linha de `organization` por outra conexão, e chamá-la com a linha já
  // travada seria esperar a si mesma até o tempo limite.
  const { garantirCreditoDoCiclo } = await import("./credito-do-ciclo");
  if ((await garantirCreditoDoCiclo(input.organizationId)).creditou) {
    const segunda = await debitarComExtrato(input, valor);
    if (segunda !== null) return { cobrado: true, valor, saldoDepois: segunda };
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { starsBalance: true },
  });
  throw new SaldoInsuficienteError(valor, org?.starsBalance ?? 0);
}

/**
 * Desconta o saldo e grava a linha do extrato **na mesma transação**.
 * Devolve o saldo resultante, ou `null` quando o saldo não cobria o valor.
 *
 * As duas escritas juntas não são preciosismo. Separadas, o processo que morre
 * entre elas deixa ★ debitado sem lançamento nenhum — a loja vê saldo sumindo
 * e não há como reconstruir de onde.
 *
 * O `gte` no `where` continua sendo a trava de concorrência: só debita quem
 * ainda tem saldo, e quem perde a corrida vê `count: 0`. O que a transação
 * acrescenta é a leitura do `balanceAfter` **sob a trava da própria linha** —
 * lida fora dela, duas cobranças simultâneas liam o saldo já descontado pelas
 * duas e gravavam o mesmo `balanceAfter`, quebrando a conferência do extrato
 * que é justamente para isso que ele serve.
 */
async function debitarComExtrato(
  input: {
    organizationId: string;
    actionKey: string;
    descricao: string;
    userId?: string;
  },
  valor: number,
): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.organization.updateMany({
      where: { id: input.organizationId, starsBalance: { gte: valor } },
      data: { starsBalance: { decrement: valor } },
    });
    if (count === 0) return null;

    const org = await tx.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { starsBalance: true },
    });

    await tx.starTransaction.create({
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

    return org.starsBalance;
  });
}

/**
 * Devolve o que foi cobrado.
 *
 * Existe para o caso de a ação falhar **depois** do débito. Um estorno é uma
 * linha nova no extrato, nunca a remoção da linha do débito: apagar história
 * financeira é como um extrato deixa de servir para auditoria.
 *
 * Saldo e extrato numa transação só, pelo mesmo motivo do débito: separados,
 * a queda entre os dois devolve ★ sem lançamento que explique de onde veio.
 */
export async function estornar(input: {
  organizationId: string;
  valor: number;
  descricao: string;
  actionKey?: string;
  userId?: string;
}): Promise<void> {
  if (input.valor <= 0) return;

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: input.organizationId },
      data: { starsBalance: { increment: input.valor } },
      select: { starsBalance: true },
    });

    await tx.starTransaction.create({
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
  });
}

/**
 * Credita saldo — recarga, cortesia, crédito de plano.
 *
 * Saldo e extrato numa transação só. Aqui é o caminho por onde entra dinheiro
 * de verdade (a recarga confirmada pelo Stripe): a queda entre as duas
 * escritas creditaria ★ sem nota fiscal nenhuma no extrato.
 */
export async function creditar(input: {
  organizationId: string;
  valor: number;
  tipo: StarTransactionType;
  descricao: string;
  userId?: string;
}): Promise<number> {
  if (input.valor <= 0) throw new Error("Crédito precisa ser positivo");

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: input.organizationId },
      data: {
        starsBalance: { increment: input.valor },
        // Primeiro crédito marca o início do ciclo.
        ...(input.tipo === "PLAN_CREDIT"
          ? { starsCycleStart: new Date() }
          : {}),
      },
      select: { starsBalance: true },
    });

    await tx.starTransaction.create({
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
  });
}

/**
 * Chaves de ação usadas hoje.
 *
 * Reexportadas de `lib/acoes-chaves`, que não é `server-only`: a tela de preços
 * roda no cliente e precisa das mesmas chaves. Quem já importa daqui continua
 * funcionando.
 */
export { ACOES } from "../lib/acoes-chaves";
