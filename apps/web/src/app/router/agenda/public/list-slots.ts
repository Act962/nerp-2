import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { gerarEncaixes } from "@/features/agenda/lib/horarios";
import { faixasDoDia } from "@/features/agenda/server/agendar";
import prisma from "@/lib/db";
import { paredeParaUtc } from "@/features/agenda/lib/horarios";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Horários livres de um dia.
 *
 * Só os livres e futuros saem daqui. Mostrar o ocupado riscado contaria para
 * qualquer um na internet quantos clientes a loja atendeu no dia — e o cliente
 * não pode clicar nele de qualquer forma.
 */
export const listPublicSlots = base
  .route({
    method: "GET",
    summary: "Horários livres de um dia",
    tags: ["Agenda pública"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      agendaSlug: z.string().min(1),
      date: z.string().regex(DATA, "Data inválida"),
    }),
  )
  .output(
    z.object({
      horarios: z.array(z.object({ hora: z.string(), fim: z.string() })),
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
      select: { id: true, slotDuration: true, isActive: true },
    });
    if (!agenda?.isActive) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    const faixas = await faixasDoDia(agenda.id, input.date);
    if (faixas.length === 0) return { horarios: [] };

    const inicioDoDia = paredeParaUtc(input.date, 0);
    const ocupados = await prisma.appointment.findMany({
      where: {
        agendaId: agenda.id,
        status: { not: "CANCELLED" },
        startsAt: {
          gte: inicioDoDia,
          lt: new Date(inicioDoDia.getTime() + 86_400_000),
        },
      },
      select: { startsAt: true, endsAt: true },
    });

    const encaixes = gerarEncaixes({
      data: input.date,
      duracaoMin: agenda.slotDuration,
      faixas,
      ocupados,
    });

    return {
      horarios: encaixes
        .filter((encaixe) => !encaixe.ocupado && !encaixe.passado)
        .map((encaixe) => ({ hora: encaixe.inicio, fim: encaixe.fim })),
    };
  });
