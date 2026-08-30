import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import { dispararAutomacoes } from "@/features/automacoes/server/disparar";
import prisma from "@/lib/db";

/**
 * Move um card no board.
 *
 * A posição é **fracionária**: em vez de renumerar a coluna inteira a cada
 * arrasto, o card recebe a média entre os dois vizinhos. Soltar entre o
 * terceiro e o quarto vira uma única escrita, não trinta.
 *
 * O cliente manda **quem são os vizinhos**, não o número da posição. Quem
 * calcula é o servidor, a partir da ordem que os vizinhos têm de fato — assim
 * dois atendentes arrastando ao mesmo tempo não gravam a mesma posição por
 * terem calculado a partir de telas diferentes.
 *
 * ## O limite da ordenação fracionária
 *
 * Dividir ao meio muitas vezes no mesmo ponto esgota a precisão da coluna
 * (`Decimal(20,10)`): a certa altura a média entre dois vizinhos é igual a um
 * deles, e a ordem passa a depender do desempate do banco. Quando o espaço
 * fica menor que o mínimo representável, esta função **renumera a etapa** de
 * mil em mil e refaz a conta. É raro e custa uma escrita por card daquela
 * coluna, mas é o que impede o board de embaralhar sozinho depois de meses.
 */

const ESPACO = new Prisma.Decimal(1000);
/** Menor folga aceitável entre vizinhos antes de renumerar a coluna. */
const FOLGA_MINIMA = new Prisma.Decimal("0.0000001");

export const moveLead = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Move o card no board", tags: ["CRM"] })
  .input(
    z.object({
      leadId: z.string().min(1),
      stageId: z.string().min(1),
      /** Card que fica imediatamente acima do soltado. */
      anteriorId: z.string().optional(),
      /** Card que fica imediatamente abaixo. */
      proximoId: z.string().optional(),
    }),
  )
  .output(
    z.object({ id: z.string(), ordem: z.number(), renumerou: z.boolean() }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    const lead = await prisma.crmLead.findFirst({
      where: { id: input.leadId, organizationId },
      select: { id: true, funnelId: true, stageId: true },
    });
    if (!lead) {
      throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
    }

    // A etapa tem que ser do mesmo funil — da mesma organização não basta.
    const etapa = await prisma.crmStage.findFirst({
      where: {
        id: input.stageId,
        organizationId,
        funnelId: lead.funnelId,
      },
      select: { id: true },
    });
    if (!etapa) {
      throw new ORPCError("NOT_FOUND", { message: "Etapa não encontrada" });
    }

    const vizinhos = await prisma.crmLead.findMany({
      where: {
        id: {
          in: [input.anteriorId, input.proximoId].filter(Boolean) as string[],
        },
        organizationId,
        stageId: input.stageId,
      },
      select: { id: true, order: true },
    });
    const ordemDe = (id?: string) =>
      id ? (vizinhos.find((v) => v.id === id)?.order ?? null) : null;

    let anterior = ordemDe(input.anteriorId);
    let proximo = ordemDe(input.proximoId);
    let renumerou = false;

    // Espaço esgotado entre os vizinhos: redistribui a coluna e recalcula.
    if (
      anterior &&
      proximo &&
      proximo.minus(anterior).lessThanOrEqualTo(FOLGA_MINIMA)
    ) {
      await renumerarEtapa(input.stageId, organizationId);
      renumerou = true;
      const refeitos = await prisma.crmLead.findMany({
        where: {
          id: {
            in: [input.anteriorId, input.proximoId].filter(Boolean) as string[],
          },
          organizationId,
          stageId: input.stageId,
        },
        select: { id: true, order: true },
      });
      anterior = refeitos.find((v) => v.id === input.anteriorId)?.order ?? null;
      proximo = refeitos.find((v) => v.id === input.proximoId)?.order ?? null;
    }

    const novaOrdem = calcularOrdem(anterior, proximo);
    const mudouDeEtapa = lead.stageId !== input.stageId;
    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          order: novaOrdem,
          ...(mudouDeEtapa
            ? {
                stageId: input.stageId,
                lastStatusChangeAt: agora,
                stageEnteredAt: agora,
              }
            : {}),
        },
      });

      // Reordenar dentro da mesma coluna não é evento de funil — só mudança de
      // etapa entra no histórico, senão a jornada vira ruído de arrasto.
      if (mudouDeEtapa) {
        await tx.crmLeadHistory.create({
          data: {
            organizationId,
            leadId: lead.id,
            action: "ACTIVE",
            eventType: "STATUS_CHANGE",
            previousStageId: lead.stageId,
            newStageId: input.stageId,
            userId: context.user.id,
          },
        });
      }
    });

    // Só mudança de etapa dispara automação: arrastar dentro da mesma coluna
    // é reordenação visual, e disparar nela encheria o funil de execuções que
    // o operador não pediu.
    if (mudouDeEtapa) {
      await dispararAutomacoes({
        organizationId,
        funnelId: lead.funnelId,
        leadId: lead.id,
        gatilho: "TRIGGER_STAGE_CHANGED",
        contexto: { etapaAnterior: lead.stageId, etapaNova: input.stageId },
      });
    }

    return { id: lead.id, ordem: Number(novaOrdem), renumerou };
  });

function calcularOrdem(
  anterior: Prisma.Decimal | null,
  proximo: Prisma.Decimal | null,
): Prisma.Decimal {
  if (anterior && proximo) return anterior.plus(proximo).dividedBy(2);
  if (anterior) return anterior.plus(ESPACO);
  if (proximo) return proximo.minus(ESPACO);
  return ESPACO;
}

/** Redistribui as posições da etapa de mil em mil, preservando a ordem atual. */
async function renumerarEtapa(
  stageId: string,
  organizationId: string,
): Promise<void> {
  const cards = await prisma.crmLead.findMany({
    where: { stageId, organizationId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    cards.map((card, indice) =>
      prisma.crmLead.update({
        where: { id: card.id },
        data: { order: ESPACO.times(indice + 1) },
      }),
    ),
  );
}
