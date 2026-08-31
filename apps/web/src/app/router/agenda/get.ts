import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { DIAS_DA_SEMANA } from "@/features/agenda/lib/horarios";
import { DayOfWeek } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

const faixa = z.object({ startTime: z.string(), endTime: z.string() });

export const getAgenda = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Abre uma agenda", tags: ["Agenda"] })
  .input(z.object({ agendaId: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      orgSlug: z.string(),
      description: z.string().nullable(),
      slotDuration: z.number(),
      isActive: z.boolean(),
      funnelId: z.string(),
      stageId: z.string().nullable(),
      /** A grade da semana inteira, um item por dia, mesmo vazio. */
      semana: z.array(
        z.object({
          dayOfWeek: z.enum(DayOfWeek),
          isActive: z.boolean(),
          faixas: z.array(faixa),
        }),
      ),
      /** Datas com o dia fechado. */
      bloqueios: z.array(z.string()),
      responsaveis: z.array(z.object({ userId: z.string(), name: z.string() })),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const agenda = await prisma.agenda.findFirst({
      where: { id: input.agendaId, organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        slotDuration: true,
        isActive: true,
        funnelId: true,
        stageId: true,
        availabilities: {
          select: {
            dayOfWeek: true,
            isActive: true,
            timeSlots: {
              orderBy: { order: "asc" },
              select: { startTime: true, endTime: true },
            },
          },
        },
        dateOverrides: {
          where: { isBlocked: true },
          orderBy: { date: "asc" },
          select: { date: true },
        },
        responsibles: {
          select: { userId: true, user: { select: { name: true } } },
        },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    const porDia = new Map(agenda.availabilities.map((d) => [d.dayOfWeek, d]));

    return {
      id: agenda.id,
      name: agenda.name,
      slug: agenda.slug,
      orgSlug: context.org.slug,
      description: agenda.description,
      slotDuration: agenda.slotDuration,
      isActive: agenda.isActive,
      funnelId: agenda.funnelId,
      stageId: agenda.stageId,
      // Os sete dias sempre, na ordem do calendário: a tela desenha a semana
      // inteira e o dia sem atendimento precisa aparecer desmarcado, não sumir.
      semana: DIAS_DA_SEMANA.map((dia) => {
        const cadastrado = porDia.get(dia);
        return {
          dayOfWeek: dia,
          isActive: cadastrado?.isActive ?? false,
          faixas: cadastrado?.timeSlots ?? [],
        };
      }),
      bloqueios: agenda.dateOverrides.map((o) => o.date),
      responsaveis: agenda.responsibles.map((r) => ({
        userId: r.userId,
        name: r.user.name,
      })),
    };
  });
