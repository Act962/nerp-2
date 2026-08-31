import "server-only";

import type { CrmNodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export type Gatilho = Extract<
  CrmNodeType,
  | "TRIGGER_NEW_LEAD"
  | "TRIGGER_MESSAGE_IN"
  | "TRIGGER_STAGE_CHANGED"
  | "TRIGGER_LEAD_IDLE"
  | "TRIGGER_MANUAL"
>;

/**
 * Encontra as automações que respondem a um gatilho e as coloca na fila.
 *
 * Nunca lança. É chamada de dentro do caminho de recebimento de mensagem e da
 * movimentação de card — lugares onde uma automação mal configurada não pode
 * derrubar a operação que a disparou. Falha vira log.
 *
 * O trabalho aqui é curto de propósito: achar, registrar a execução e publicar
 * o evento. Quem executa é o Inngest, que sobrevive a deploy e sabe esperar.
 */
export async function dispararAutomacoes(input: {
  organizationId: string;
  funnelId: string;
  leadId: string;
  gatilho: Gatilho;
  textoDaMensagem?: string | null;
  /** Contexto extra gravado na execução (etapa de origem, por exemplo). */
  contexto?: Record<string, unknown>;
}): Promise<{ disparadas: number }> {
  try {
    const workflows = await prisma.crmWorkflow.findMany({
      where: {
        organizationId: input.organizationId,
        funnelId: input.funnelId,
        isActive: true,
        nodes: { some: { type: input.gatilho } },
      },
      select: { id: true, maxRunsPerHour: true, createdById: true },
    });

    if (workflows.length === 0) return { disparadas: 0 };

    let disparadas = 0;
    for (const workflow of workflows) {
      if (await passouDoTeto(workflow.id, workflow.maxRunsPerHour)) continue;

      const execucao = await prisma.crmWorkflowRun.create({
        data: {
          organizationId: input.organizationId,
          workflowId: workflow.id,
          leadId: input.leadId,
          triggerType: input.gatilho,
          initialContext: {
            ...(input.contexto ?? {}),
            textoDaMensagem: input.textoDaMensagem ?? null,
          },
        },
        select: { id: true },
      });

      await inngest.send({
        name: "crm/automacao.disparada",
        data: {
          runId: execucao.id,
          workflowId: workflow.id,
          organizationId: input.organizationId,
          funnelId: input.funnelId,
          leadId: input.leadId,
          autorId: workflow.createdById,
          textoDaMensagem: input.textoDaMensagem ?? null,
        },
      });

      disparadas += 1;
    }

    return { disparadas };
  } catch (erro) {
    console.error("[automacoes] disparo_falhou", {
      gatilho: input.gatilho,
      funnelId: input.funnelId,
      erro,
    });
    return { disparadas: 0 };
  }
}

/**
 * Teto de execuções por hora.
 *
 * Existe porque a automação que manda mensagem pode ser disparada pela
 * resposta que ela mesma provocou. O ciclo é recusado na validação do grafo,
 * mas dois workflows apontando um para o outro passam por lá — e o teto é o
 * que segura isso sem ninguém precisar perceber.
 *
 * Quando estoura, grava **uma** linha `RATE_LIMITED` por janela: o operador
 * precisa ver que travou, e mil linhas iguais não contam nada a mais.
 */
async function passouDoTeto(
  workflowId: string,
  teto: number,
): Promise<boolean> {
  const desde = new Date(Date.now() - 60 * 60_000);

  const execucoes = await prisma.crmWorkflowRun.count({
    where: { workflowId, startedAt: { gte: desde } },
  });
  if (execucoes < teto) return false;

  const jaAvisou = await prisma.crmWorkflowRun.findFirst({
    where: { workflowId, status: "RATE_LIMITED", startedAt: { gte: desde } },
    select: { id: true },
  });

  if (!jaAvisou) {
    const workflow = await prisma.crmWorkflow.findUnique({
      where: { id: workflowId },
      select: { organizationId: true },
    });
    if (workflow) {
      await prisma.crmWorkflowRun.create({
        data: {
          organizationId: workflow.organizationId,
          workflowId,
          triggerType: "TRIGGER_MANUAL",
          status: "RATE_LIMITED",
          errorMessage: `A automação bateu o limite de ${teto} execuções por hora e foi pausada até a próxima janela.`,
          finishedAt: new Date(),
        },
      });
    }
  }

  return true;
}
