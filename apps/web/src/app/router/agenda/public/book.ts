import { z } from "zod";
import { base } from "@/app/middlewares/base";
import {
  agendarCompromisso,
  HorarioIndisponivelError,
  HorarioOcupadoError,
} from "@/features/agenda/server/agendar";
import prisma from "@/lib/db";
import { normalizeWhatsapp } from "@/lib/whatsapp";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Quantos compromissos futuros o mesmo telefone pode ter na mesma agenda. */
const LIMITE_POR_TELEFONE = 3;

export const bookPublicAgenda = base
  .route({
    method: "POST",
    summary: "Marca pelo link público",
    tags: ["Agenda pública"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      agendaSlug: z.string().min(1),
      date: z.string().regex(DATA, "Data inválida"),
      time: z.string().regex(HORA, "Horário inválido"),
      name: z.string().trim().min(2, "Informe seu nome"),
      phone: z.string().trim().min(1, "Informe seu WhatsApp"),
      email: z
        .string()
        .trim()
        .email("E-mail inválido")
        .optional()
        .or(z.literal("")),
      notes: z.string().trim().max(500).optional(),
    }),
  )
  .output(
    z.object({
      appointmentId: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });
    if (!org) throw errors.NOT_FOUND({ message: "Agenda não encontrada" });

    const agenda = await prisma.agenda.findUnique({
      where: {
        slug_organizationId: {
          slug: input.agendaSlug,
          organizationId: org.id,
        },
      },
      select: { id: true, isActive: true },
    });
    if (!agenda?.isActive) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    const telefone = normalizeWhatsapp(input.phone);
    if (!telefone) {
      throw errors.BAD_REQUEST({
        message: "Informe um celular com WhatsApp, com DDD",
      });
    }

    // Freio para o formulário aberto na internet: sem isso um script enche a
    // agenda inteira em segundos, e o duplo clique de quem está com pressa
    // marca duas vezes.
    const jaMarcados = await prisma.appointment.count({
      where: {
        agendaId: agenda.id,
        status: { not: "CANCELLED" },
        startsAt: { gte: new Date() },
        lead: { phone: telefone },
      },
    });
    if (jaMarcados >= LIMITE_POR_TELEFONE) {
      throw errors.BAD_REQUEST({
        message:
          "Você já tem horários marcados nesta agenda. Cancele um deles para marcar outro.",
      });
    }

    try {
      const marcado = await agendarCompromisso({
        organizationId: org.id,
        agendaId: agenda.id,
        data: input.date,
        hora: input.time,
        nome: input.name,
        telefone,
        email: input.email || null,
        observacao: input.notes || null,
      });

      return {
        appointmentId: marcado.appointmentId,
        startsAt: marcado.startsAt.toISOString(),
        endsAt: marcado.endsAt.toISOString(),
      };
    } catch (erro) {
      // Sem `CONFLICT` no mapa de erros do projeto; para a tela os dois casos
      // terminam igual — mostra a mensagem e recarrega os horários do dia.
      if (erro instanceof HorarioOcupadoError) {
        throw errors.BAD_REQUEST({ message: erro.message });
      }
      if (erro instanceof HorarioIndisponivelError) {
        throw errors.BAD_REQUEST({ message: erro.message });
      }
      throw erro;
    }
  });
