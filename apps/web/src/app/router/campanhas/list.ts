import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

const STATUS = [
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "PAUSED",
  "FAILED",
  "CANCELLED",
] as const;

export const listCampanhas = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Lista as campanhas", tags: ["Campanhas"] })
  .input(z.object({ funnelId: z.string().optional() }))
  .output(
    z.object({
      campanhas: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          status: z.enum(STATUS),
          funil: z.string(),
          template: z.string().nullable(),
          totalDestinatarios: z.number(),
          enviadas: z.number(),
          entregues: z.number(),
          lidas: z.number(),
          falharam: z.number(),
          agendadaPara: z.string().nullable(),
          criadaEm: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const campanhas = await prisma.broadcast.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.funnelId ? { funnelId: input.funnelId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        templateName: true,
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        scheduledAt: true,
        createdAt: true,
        funnel: { select: { name: true } },
      },
    });

    return {
      campanhas: campanhas.map((campanha) => ({
        id: campanha.id,
        nome: campanha.name,
        status: campanha.status,
        funil: campanha.funnel.name,
        template: campanha.templateName,
        totalDestinatarios: campanha.totalRecipients,
        enviadas: campanha.sentCount,
        entregues: campanha.deliveredCount,
        lidas: campanha.readCount,
        falharam: campanha.failedCount,
        agendadaPara: campanha.scheduledAt?.toISOString() ?? null,
        criadaEm: campanha.createdAt.toISOString(),
      })),
    };
  });
