import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  agendarCompromisso,
  HorarioIndisponivelError,
  HorarioOcupadoError,
} from "@/features/agenda/server/agendar";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { requireAgendaDaOrg } from "./_access";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * O atendente marcando pelo ERP.
 *
 * Passa pelo mesmo `agendarCompromisso` da página pública — inclusive na
 * checagem de grade e de data bloqueada. Uma porta interna que ignora as
 * regras é como a agenda começa a ter compromisso em dia fechado.
 */
export const createAppointment = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Marca um compromisso", tags: ["Agenda"] })
  .input(
    z.object({
      agendaId: z.string().min(1),
      date: z.string().regex(DATA, "Data inválida"),
      time: z.string().regex(HORA, "Horário inválido"),
      name: z.string().trim().min(1, "Informe o nome"),
      phone: z.string().trim().min(1, "Informe o WhatsApp"),
      email: z.string().trim().email().optional().or(z.literal("")),
      notes: z.string().trim().optional(),
      meetingType: z.enum(["ONLINE", "IN_PERSON"]).default("ONLINE"),
    }),
  )
  .output(
    z.object({
      appointmentId: z.string(),
      leadId: z.string(),
      startsAt: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    await requireAgendaDaOrg(input.agendaId, organizationId);

    const telefone = normalizeWhatsapp(input.phone);
    if (!telefone) {
      throw errors.BAD_REQUEST({
        message: "Informe um celular com WhatsApp, com DDD",
      });
    }

    try {
      const marcado = await agendarCompromisso({
        organizationId,
        agendaId: input.agendaId,
        data: input.date,
        hora: input.time,
        nome: input.name,
        telefone,
        email: input.email || null,
        observacao: input.notes || null,
        meetingType: input.meetingType,
        userId: context.user.id,
      });

      return {
        appointmentId: marcado.appointmentId,
        leadId: marcado.leadId,
        startsAt: marcado.startsAt.toISOString(),
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
