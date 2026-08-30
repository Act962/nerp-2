import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const listAppointments = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Lista compromissos de um período",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string().optional(),
      /** "YYYY-MM-DD" — intervalo fechado no início, aberto no fim. */
      de: z.string().regex(DATA),
      ate: z.string().regex(DATA),
    }),
  )
  .output(
    z.object({
      compromissos: z.array(
        z.object({
          id: z.string(),
          agendaId: z.string(),
          agendaName: z.string(),
          title: z.string().nullable(),
          notes: z.string().nullable(),
          startsAt: z.string(),
          endsAt: z.string(),
          status: z.string(),
          leadId: z.string().nullable(),
          leadName: z.string().nullable(),
          leadPhone: z.string().nullable(),
          customerId: z.string().nullable(),
          responsavel: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    const compromissos = await prisma.appointment.findMany({
      where: {
        organizationId,
        ...(input.agendaId ? { agendaId: input.agendaId } : {}),
        startsAt: {
          gte: new Date(`${input.de}T00:00:00.000Z`),
          // O fim vem exclusivo do cliente; um dia inteiro de folga cobre o
          // deslocamento do fuso sem perder compromisso de borda.
          lt: new Date(`${input.ate}T23:59:59.999Z`),
        },
      },
      orderBy: { startsAt: "asc" },
      take: 500,
      select: {
        id: true,
        agendaId: true,
        title: true,
        notes: true,
        startsAt: true,
        endsAt: true,
        status: true,
        leadId: true,
        agenda: { select: { name: true } },
        lead: { select: { name: true, phone: true, customerId: true } },
        user: { select: { name: true } },
      },
    });

    return {
      compromissos: compromissos.map((c) => ({
        id: c.id,
        agendaId: c.agendaId,
        agendaName: c.agenda.name,
        title: c.title,
        notes: c.notes,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        status: c.status,
        leadId: c.leadId,
        leadName: c.lead?.name ?? null,
        leadPhone: c.lead?.phone ?? null,
        customerId: c.lead?.customerId ?? null,
        responsavel: c.user?.name ?? null,
      })),
    };
  });
