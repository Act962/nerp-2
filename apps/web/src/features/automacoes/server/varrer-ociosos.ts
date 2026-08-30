import "server-only";

import prisma from "@/lib/db";
import { dispararAutomacoes } from "./disparar";

/** Quantos leads uma varredura processa por workflow. */
const TETO_POR_WORKFLOW = 200;

/**
 * De quanto tempo para trás a varredura olha, a partir do instante em que o
 * lead completa o silêncio configurado.
 *
 * A varredura dispara na **travessia** do limite, não no estado "está parado".
 * A diferença importa: pelo estado, todo lead antigo e calado continuaria
 * aparecendo em toda varredura para sempre, e o teto por rodada seria ocupado
 * pelos mesmos de sempre — os que acabaram de ficar parados nunca chegariam a
 * ser atendidos.
 *
 * Duas horas com uma varredura a cada quinze minutos dá oito passagens de
 * folga: mesmo que algumas falhem, o lead que cruzou o limite é pego.
 */
const JANELA_DE_TRAVESSIA_MS = 2 * 60 * 60_000;

/**
 * Dispara as automações de "lead parado há X minutos".
 *
 * É o único gatilho que não nasce de uma ação — ninguém clica em "ficar em
 * silêncio" —, então depende de varredura.
 *
 * A repetição é controlada pelo próprio histórico, sem tabela de marcação:
 * não dispara se já houver execução deste workflow para este lead **depois**
 * da última mensagem que ele mandou. Quando o cliente volta a falar, a última
 * mensagem passa a ser mais nova que a execução e o lead fica elegível de
 * novo, que é exatamente a regra desejada.
 *
 * Lead sem `lastInboundAt` fica de fora: nunca falou, então não está "parado",
 * está "sem contato".
 */
export async function varrerLeadsOciosos(agora = new Date()): Promise<{
  workflows: number;
  disparos: number;
}> {
  const workflows = await prisma.crmWorkflow.findMany({
    where: {
      isActive: true,
      nodes: { some: { type: "TRIGGER_LEAD_IDLE" } },
    },
    select: {
      id: true,
      organizationId: true,
      funnelId: true,
      nodes: {
        where: { type: "TRIGGER_LEAD_IDLE" },
        select: { data: true },
        take: 1,
      },
    },
  });

  let disparos = 0;

  for (const workflow of workflows) {
    const configuracao = (workflow.nodes[0]?.data ?? {}) as {
      minutos?: unknown;
    };
    const minutos = Number(configuracao.minutos ?? 0);
    if (!Number.isFinite(minutos) || minutos <= 0) continue;

    const corte = new Date(agora.getTime() - minutos * 60_000);
    const inicioDaJanela = new Date(corte.getTime() - JANELA_DE_TRAVESSIA_MS);

    const candidatos = await prisma.crmLead.findMany({
      where: {
        organizationId: workflow.organizationId,
        funnelId: workflow.funnelId,
        isActive: true,
        isArchived: false,
        currentAction: "ACTIVE",
        lastInboundAt: { gte: inicioDaJanela, lte: corte },
      },
      orderBy: { lastInboundAt: "desc" },
      take: TETO_POR_WORKFLOW,
      select: { id: true, lastInboundAt: true },
    });

    if (candidatos.length === 0) continue;

    // Uma execução por lead, a mais recente. O `distinct` evita trazer o
    // histórico inteiro de quem já rodou muitas vezes.
    const jaRodaram = await prisma.crmWorkflowRun.findMany({
      where: {
        workflowId: workflow.id,
        leadId: { in: candidatos.map((lead) => lead.id) },
      },
      orderBy: { startedAt: "desc" },
      distinct: ["leadId"],
      select: { leadId: true, startedAt: true },
    });
    const ultimaExecucao = new Map(
      jaRodaram.map((run) => [run.leadId, run.startedAt]),
    );

    for (const lead of candidatos) {
      const rodouEm = ultimaExecucao.get(lead.id);
      // Rodou depois da última fala dele: o silêncio é o mesmo de antes.
      if (rodouEm && lead.lastInboundAt && rodouEm >= lead.lastInboundAt) {
        continue;
      }

      const resultado = await dispararAutomacoes({
        organizationId: workflow.organizationId,
        funnelId: workflow.funnelId,
        leadId: lead.id,
        gatilho: "TRIGGER_LEAD_IDLE",
        contexto: { minutosSemResposta: minutos },
      });
      disparos += resultado.disparadas;
    }
  }

  return { workflows: workflows.length, disparos };
}
