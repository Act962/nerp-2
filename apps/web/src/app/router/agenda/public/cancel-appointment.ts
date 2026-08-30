import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";

/**
 * O cliente desmarcando pelo próprio link.
 *
 * Marca `cancelledBy: "CLIENT"` — a loja precisa distinguir o horário que ela
 * cancelou do que o cliente desmarcou, e o `updateMany` filtrado por status
 * faz o segundo clique não reabrir nada.
 */
export const cancelPublicAppointment = base
  .route({
    method: "POST",
    summary: "Cancela pelo link do cliente",
    tags: ["Agenda pública"],
  })
  .input(z.object({ appointmentId: z.string().min(1) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const { count } = await prisma.appointment.updateMany({
      where: {
        id: input.appointmentId,
        status: { not: "CANCELLED" },
        // Horário que já passou não se desmarca: cancelar depois só serviria
        // para sumir com a falta no histórico.
        startsAt: { gte: new Date() },
      },
      data: { status: "CANCELLED", cancelledBy: "CLIENT" },
    });

    if (count === 0) {
      throw errors.NOT_FOUND({
        message: "Agendamento não encontrado, já cancelado ou já realizado",
      });
    }

    return { ok: true };
  });
