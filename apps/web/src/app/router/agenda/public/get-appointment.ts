import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";

/**
 * O comprovante do cliente, aberto pelo id do compromisso.
 *
 * O id é a credencial: é um cuid, não sequencial, e só quem marcou recebeu o
 * link. Por isso a resposta traz o primeiro nome e não o telefone nem o
 * e-mail — quem chuta um id não leva dado de contato de ninguém.
 */
export const getPublicAppointment = base
  .route({
    method: "GET",
    summary: "Comprovante do agendamento",
    tags: ["Agenda pública"],
  })
  .input(z.object({ appointmentId: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.string(),
      agendaName: z.string(),
      organizationName: z.string(),
      primeiroNome: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const compromisso = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        agenda: { select: { name: true } },
        organization: { select: { name: true } },
        lead: { select: { name: true } },
      },
    });

    if (!compromisso) {
      throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    }

    return {
      id: compromisso.id,
      startsAt: compromisso.startsAt.toISOString(),
      endsAt: compromisso.endsAt.toISOString(),
      status: compromisso.status,
      agendaName: compromisso.agenda.name,
      organizationName: compromisso.organization.name,
      primeiroNome: compromisso.lead?.name.split(" ")[0] ?? null,
    };
  });
