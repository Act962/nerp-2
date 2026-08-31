import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

export const cancelAppointment = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Cancela um compromisso",
    tags: ["Agenda"],
  })
  .input(z.object({ appointmentId: z.string().min(1) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    // Cancelar libera o horário para outra pessoa, então o filtro por
    // organização é a diferença entre liberar o seu e apagar o do vizinho.
    const { count } = await prisma.appointment.updateMany({
      where: {
        id: input.appointmentId,
        organizationId: context.org.id,
        status: { not: "CANCELLED" },
      },
      data: { status: "CANCELLED", cancelledBy: context.user.id },
    });

    if (count === 0) {
      throw errors.NOT_FOUND({
        message: "Compromisso não encontrado ou já cancelado",
      });
    }

    return { ok: true };
  });
