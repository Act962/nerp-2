import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { DayOfWeek } from "@/generated/prisma/enums";
import { emMinutos } from "@/features/agenda/lib/horarios";
import prisma from "@/lib/db";
import { requireAgendaDaOrg } from "./_access";

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Grava a grade semanal inteira de uma vez.
 *
 * Substituir tudo, em vez de mandar diferença por faixa, é o que casa com a
 * tela: o operador arrasta horários de vários dias e salva. Diferença parcial
 * exigiria o cliente saber o id de cada faixa e reconciliar — mais caminhos
 * para a grade ficar meio salva.
 */
export const setAvailability = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Grava a grade semanal da agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string().min(1),
      semana: z.array(
        z.object({
          dayOfWeek: z.enum(DayOfWeek),
          isActive: z.boolean(),
          faixas: z.array(
            z.object({
              startTime: z.string().regex(HORA, "Horário inválido"),
              endTime: z.string().regex(HORA, "Horário inválido"),
            }),
          ),
        }),
      ),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const agenda = await requireAgendaDaOrg(input.agendaId, context.org.id);

    for (const dia of input.semana) {
      for (const faixa of dia.faixas) {
        const inicio = emMinutos(faixa.startTime);
        const fim = emMinutos(faixa.endTime);
        if (inicio === null || fim === null || fim <= inicio) {
          throw errors.BAD_REQUEST({
            message: `Faixa inválida em ${dia.dayOfWeek}: ${faixa.startTime} às ${faixa.endTime}`,
          });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Apagar e recriar: as faixas caem por cascata, então não sobra horário
      // órfão de uma grade anterior.
      await tx.agendaAvailability.deleteMany({
        where: { agendaId: agenda.id },
      });

      for (const dia of input.semana) {
        if (!dia.isActive && dia.faixas.length === 0) continue;
        await tx.agendaAvailability.create({
          data: {
            agendaId: agenda.id,
            dayOfWeek: dia.dayOfWeek,
            isActive: dia.isActive,
            timeSlots: {
              create: dia.faixas.map((faixa, ordem) => ({
                startTime: faixa.startTime,
                endTime: faixa.endTime,
                order: ordem,
              })),
            },
          },
        });
      }
    });

    return { ok: true };
  });
