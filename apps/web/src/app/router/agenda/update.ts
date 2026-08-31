import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireAgendaDaOrg } from "./_access";

export const updateAgenda = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Edita uma agenda", tags: ["Agenda"] })
  .input(
    z.object({
      agendaId: z.string().min(1),
      name: z.string().trim().min(1).optional(),
      description: z.string().trim().nullable().optional(),
      slotDuration: z.number().int().min(5).max(480).optional(),
      isActive: z.boolean().optional(),
      /** Etapa em que o lead cai ao agendar; `null` mantém onde está. */
      stageId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const agenda = await requireAgendaDaOrg(input.agendaId, organizationId);

    if (input.stageId) {
      const estagio = await prisma.crmStage.findFirst({
        where: {
          id: input.stageId,
          organizationId,
          funnelId: agenda.funnelId,
        },
        select: { id: true },
      });
      if (!estagio) {
        throw errors.NOT_FOUND({
          message: "Etapa não encontrada neste funil",
        });
      }
    }

    await prisma.agenda.update({
      where: { id: agenda.id },
      data: {
        name: input.name,
        description: input.description,
        slotDuration: input.slotDuration,
        isActive: input.isActive,
        stageId: input.stageId,
      },
    });

    return { id: agenda.id };
  });
