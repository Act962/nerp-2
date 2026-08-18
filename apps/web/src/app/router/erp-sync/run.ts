import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { erpSyncRequested, inngest } from "@/lib/inngest/client";
import { requireOrgAdmin } from "./_access";

const SYNC_STUCK_AFTER_MS = 15 * 60 * 1000;

/**
 * Dispara o sync e devolve na hora — não roda inline.
 *
 * Rodar inline seguraria o request pelo tempo do sync e arriscaria timeout de
 * função na Vercel numa janela grande. Segue o padrão do projeto: marca o
 * registro, emite o evento, e a UI acompanha por polling em `erpSync.status`.
 */
export const runErpSyncNow = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Sincronizar o ERP externo agora",
    tags: ["erp-sync"],
  })
  .input(
    z.object({
      // Janela maior para recuperar mudança tardia sem esperar a passada noturna.
      windowDays: z.number().int().min(1).max(365).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const connection = await prisma.erpConnection.findUnique({
      where: { organizationId: context.org.id },
      select: { kind: true, status: true, syncStartedAt: true },
    });

    if (!connection || connection.kind === "NATIVE") {
      throw errors.NOT_FOUND({
        message: "Esta organização não tem ERP externo configurado.",
      });
    }
    if (connection.status === "PAUSED") {
      throw errors.BAD_REQUEST({
        message: "A integração está pausada. Reative antes de sincronizar.",
      });
    }

    const startedAt = connection.syncStartedAt;
    if (startedAt && Date.now() - startedAt.getTime() < SYNC_STUCK_AFTER_MS) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma sincronização em andamento.",
      });
    }

    await prisma.erpConnection.update({
      where: { organizationId: context.org.id },
      data: { syncStartedAt: new Date() },
    });

    try {
      await inngest.send(
        erpSyncRequested.create({
          organizationId: context.org.id,
          windowDays: input.windowDays,
        }),
      );
    } catch (error) {
      // Sem isso a conexão ficaria travada em "sincronizando" por 15 minutos
      // por causa de uma falha que aconteceu antes do sync começar.
      await prisma.erpConnection
        .update({
          where: { organizationId: context.org.id },
          data: { syncStartedAt: null },
        })
        .catch(() => {});
      console.error("[erpSync.run] inngest.send falhou:", error);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Não foi possível agendar a sincronização.",
      });
    }

    return { scheduled: true };
  });
