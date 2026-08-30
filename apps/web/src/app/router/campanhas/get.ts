import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireCampanhaDaOrg } from "./_access";

const STATUS_DESTINATARIO = [
  "PENDING",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "SKIPPED",
] as const;

/** Detalhe da campanha, com uma amostra dos destinatários. */
export const getCampanha = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Detalhe da campanha", tags: ["Campanhas"] })
  .input(z.object({ broadcastId: z.string().min(1) }))
  .output(
    z.object({
      id: z.string(),
      nome: z.string(),
      status: z.string(),
      funnelId: z.string(),
      template: z
        .object({
          nome: z.string(),
          idioma: z.string(),
          categoria: z.string().nullable(),
        })
        .nullable(),
      contadores: z.object({
        total: z.number(),
        enviadas: z.number(),
        entregues: z.number(),
        lidas: z.number(),
        falharam: z.number(),
      }),
      destinatarios: z.array(
        z.object({
          id: z.string(),
          nome: z.string().nullable(),
          telefone: z.string(),
          status: z.enum(STATUS_DESTINATARIO),
          erro: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireCampanhaDaOrg(input.broadcastId, organizationId);

    const campanha = await prisma.broadcast.findUniqueOrThrow({
      where: { id: input.broadcastId },
      select: {
        id: true,
        name: true,
        status: true,
        funnelId: true,
        templateName: true,
        templateLanguage: true,
        templateCategory: true,
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        recipients: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            errorMessage: true,
          },
          orderBy: { createdAt: "asc" },
          // Amostra: uma campanha de milhares não cabe na tela nem precisa.
          take: 100,
        },
      },
    });

    return {
      id: campanha.id,
      nome: campanha.name,
      status: campanha.status,
      funnelId: campanha.funnelId,
      template: campanha.templateName
        ? {
            nome: campanha.templateName,
            idioma: campanha.templateLanguage ?? "pt_BR",
            categoria: campanha.templateCategory,
          }
        : null,
      contadores: {
        total: campanha.totalRecipients,
        enviadas: campanha.sentCount,
        entregues: campanha.deliveredCount,
        lidas: campanha.readCount,
        falharam: campanha.failedCount,
      },
      destinatarios: campanha.recipients.map((destinatario) => ({
        id: destinatario.id,
        nome: destinatario.name,
        telefone: destinatario.phone,
        status: destinatario.status,
        erro: destinatario.errorMessage,
      })),
    };
  });
