import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Edita a ficha do lead a partir da lateral do chat.
 *
 * Cada id que chega do cliente é reconferido contra a organização antes de
 * virar `data` — `stageId` e `responsibleId` inclusive. Aceitar o id como veio
 * seria mover um lead para o estágio de outro tenant.
 *
 * Mudança de estágio grava histórico: é o que alimenta a jornada do cliente e
 * o relatório de tempo por etapa. Sem isso o funil vira só uma foto do agora.
 */
export const updateLead = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Atualiza o lead", tags: ["CRM"] })
  .input(
    z.object({
      leadId: z.string().min(1),
      nome: z.string().trim().min(1).optional(),
      email: z.string().trim().optional(),
      documento: z.string().trim().optional(),
      valor: z.number().min(0).optional(),
      temperatura: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional(),
      statusFlow: z.enum(["NEW", "ACTIVE", "WAITING", "FINISHED"]).optional(),
      estagioId: z.string().optional(),
      /** `null` remove o responsável. */
      responsavelId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    const lead = await prisma.crmLead.findFirst({
      where: { id: input.leadId, organizationId },
      select: { id: true, funnelId: true, stageId: true },
    });
    if (!lead) {
      throw new ORPCError("NOT_FOUND", { message: "Cliente não encontrado" });
    }

    if (input.estagioId && input.estagioId !== lead.stageId) {
      const estagio = await prisma.crmStage.findFirst({
        // O estágio tem que ser do MESMO funil, não só da mesma organização:
        // mover para uma coluna de outro funil deixaria o card órfão do board.
        where: {
          id: input.estagioId,
          organizationId,
          funnelId: lead.funnelId,
        },
        select: { id: true },
      });
      if (!estagio) {
        throw new ORPCError("NOT_FOUND", { message: "Etapa não encontrada" });
      }
    }

    if (input.responsavelId) {
      const membro = await prisma.member.findFirst({
        where: { organizationId, userId: input.responsavelId },
        select: { id: true },
      });
      if (!membro) {
        throw new ORPCError("NOT_FOUND", {
          message: "Responsável não encontrado nesta organização",
        });
      }
    }

    const mudouEstagio = Boolean(
      input.estagioId && input.estagioId !== lead.stageId,
    );
    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          ...(input.nome !== undefined ? { name: input.nome } : {}),
          ...(input.email !== undefined ? { email: input.email || null } : {}),
          ...(input.documento !== undefined
            ? { document: input.documento || null }
            : {}),
          ...(input.valor !== undefined ? { amount: input.valor } : {}),
          ...(input.temperatura !== undefined
            ? { temperature: input.temperatura }
            : {}),
          ...(input.statusFlow !== undefined
            ? { statusFlow: input.statusFlow }
            : {}),
          ...(input.responsavelId !== undefined
            ? { responsibleId: input.responsavelId }
            : {}),
          ...(mudouEstagio
            ? {
                stageId: input.estagioId,
                lastStatusChangeAt: agora,
                // Reinicia o cronômetro da etapa — é o que mede quanto tempo o
                // cliente ficou parado em cada uma.
                stageEnteredAt: agora,
              }
            : {}),
        },
      });

      if (mudouEstagio) {
        await tx.crmLeadHistory.create({
          data: {
            organizationId,
            leadId: lead.id,
            action: "ACTIVE",
            eventType: "STATUS_CHANGE",
            previousStageId: lead.stageId,
            newStageId: input.estagioId,
            userId: context.user.id,
          },
        });
      }
    });

    return { id: lead.id };
  });
