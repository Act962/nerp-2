import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

export const listAgendas = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Lista as agendas", tags: ["Agenda"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      orgSlug: z.string(),
      agendas: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable(),
          slotDuration: z.number(),
          isActive: z.boolean(),
          funnelId: z.string(),
          funnelName: z.string(),
          /** Compromissos ainda por acontecer — o que interessa na lista. */
          proximos: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    const agendas = await prisma.agenda.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        slotDuration: true,
        isActive: true,
        funnelId: true,
        funnel: { select: { name: true } },
        _count: {
          select: {
            appointments: {
              where: {
                status: { not: "CANCELLED" },
                startsAt: { gte: new Date() },
              },
            },
          },
        },
      },
    });

    return {
      orgSlug: context.org.slug,
      agendas: agendas.map((agenda) => ({
        id: agenda.id,
        name: agenda.name,
        slug: agenda.slug,
        description: agenda.description,
        slotDuration: agenda.slotDuration,
        isActive: agenda.isActive,
        funnelId: agenda.funnelId,
        funnelName: agenda.funnel.name,
        proximos: agenda._count.appointments,
      })),
    };
  });
