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

/**
 * Até quando dá para marcar. Sem teto, a regex de data aceita `9999-12-31` e a
 * grade semanal gera encaixe para qualquer dia útil de qualquer ano — sobra
 * limpeza manual para a loja.
 */
const ANTECEDENCIA_MAXIMA_DIAS = 180;

/**
 * Freio de enxurrada, por agenda.
 *
 * O limite por telefone sozinho não segura um script: o telefone é escolhido
 * por quem chama, e um número novo a cada requisição começa do zero. Este
 * conta o que saiu **pelo formulário público** (`userId: null` — quem marca
 * pelo ERP grava o atendente) numa janela curta.
 *
 * Os números são folgados para uma loja de verdade: quinze marcações pelo
 * formulário em dez minutos, na mesma agenda, é robô. Quando estoura, a
 * recusa é temporária e a mensagem diz isso.
 */
const JANELA_DE_ENXURRADA_MS = 10 * 60_000;
const LIMITE_NA_JANELA = 15;

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

    const agora = new Date();

    const limiteDaData = new Date(agora);
    limiteDaData.setUTCDate(
      limiteDaData.getUTCDate() + ANTECEDENCIA_MAXIMA_DIAS,
    );
    if (input.date > limiteDaData.toISOString().slice(0, 10)) {
      throw errors.BAD_REQUEST({
        message: `Só dá para marcar com até ${ANTECEDENCIA_MAXIMA_DIAS} dias de antecedência.`,
      });
    }

    // Freio de enxurrada. Vem antes do freio por telefone porque é o que
    // segura o script: aquele conta por número, e número é escolhido por quem
    // chama.
    const recentes = await prisma.appointment.count({
      where: {
        agendaId: agenda.id,
        userId: null,
        createdAt: { gte: new Date(agora.getTime() - JANELA_DE_ENXURRADA_MS) },
      },
    });
    if (recentes >= LIMITE_NA_JANELA) {
      console.warn("[agenda:publica] enxurrada de marcações", {
        agendaId: agenda.id,
        organizationId: org.id,
        recentes,
      });
      throw errors.BAD_REQUEST({
        message:
          "Muitas marcações seguidas nesta agenda. Tente de novo em alguns minutos.",
      });
    }

    // Freio do duplo clique de quem está com pressa, e do cliente que marca
    // horário demais.
    const jaMarcados = await prisma.appointment.count({
      where: {
        agendaId: agenda.id,
        status: { not: "CANCELLED" },
        startsAt: { gte: agora },
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
