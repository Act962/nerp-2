import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireAgendaDaOrg } from "./_access";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha (ou reabre) um dia específico — feriado, viagem, balanço. */
export const setDateOverride = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Bloqueia ou libera uma data",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string().min(1),
      date: z.string().regex(DATA, "Data inválida"),
      isBlocked: z.boolean(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    const agenda = await requireAgendaDaOrg(input.agendaId, context.org.id);

    if (input.isBlocked) {
      await prisma.agendaDateOverride.upsert({
        where: { agendaId_date: { agendaId: agenda.id, date: input.date } },
        create: { agendaId: agenda.id, date: input.date, isBlocked: true },
        update: { isBlocked: true },
      });
    } else {
      // Liberar apaga a linha em vez de gravar `isBlocked: false`: sem exceção
      // registrada, o dia volta a valer o que a grade semanal disser.
      await prisma.agendaDateOverride.deleteMany({
        where: { agendaId: agenda.id, date: input.date },
      });
    }

    return { ok: true };
  });
