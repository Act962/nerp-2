import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { modoDemoLigado } from "@/features/whatsapp-chat/lib/providers";
import prisma from "@/lib/db";
import { campanhaDisparoSolicitado, inngest } from "@/lib/inngest/client";
import { requireCampanhaDaOrg } from "./_access";

/**
 * Dispara a campanha.
 *
 * A passagem para `SENDING` é um `updateMany` **condicionado ao status
 * atual**. É o que impede o disparo em dobro: dois cliques rápidos, ou o
 * clique acontecendo junto com o agendamento, e só um dos dois encontra a
 * campanha em rascunho — o outro atualiza zero linhas e para aqui, sem ter
 * enviado nada.
 *
 * O evento só é publicado depois da reivindicação, nunca antes.
 */
export const sendCampanha = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Dispara a campanha", tags: ["Campanhas"] })
  .input(z.object({ broadcastId: z.string().min(1) }))
  .output(z.object({ disparando: z.boolean(), destinatarios: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const campanha = await requireCampanhaDaOrg(
      input.broadcastId,
      organizationId,
    );

    if (!campanha.templateName || !campanha.templateLanguage) {
      throw errors.BAD_REQUEST({
        message: "Escolha um template aprovado antes de disparar.",
      });
    }

    const pendentes = await prisma.broadcastRecipient.count({
      where: { broadcastId: campanha.id, status: "PENDING" },
    });
    if (pendentes === 0) {
      throw errors.BAD_REQUEST({
        message: "A campanha não tem destinatários pendentes.",
      });
    }

    // Sem número conectado não há de onde a mensagem sair. No modo demo o
    // provedor é dublado, então a checagem não se aplica.
    if (!modoDemoLigado()) {
      const conexao = await prisma.whatsAppConnection.findFirst({
        where: { funnelId: campanha.funnelId, organizationId },
        select: { id: true, status: true },
      });
      if (!conexao) {
        throw errors.BAD_REQUEST({
          message:
            "O funil desta campanha não tem número de WhatsApp conectado.",
        });
      }
    }

    // A reivindicação. Só quem encontrar a campanha parada consegue mudá-la.
    const { count } = await prisma.broadcast.updateMany({
      where: {
        id: campanha.id,
        organizationId,
        status: { in: ["DRAFT", "SCHEDULED"] },
      },
      data: { status: "SENDING", startedAt: new Date() },
    });

    if (count === 0) {
      throw errors.BAD_REQUEST({
        message: "Esta campanha já está disparando ou já foi enviada.",
      });
    }

    // Publicar pode falhar (fila fora do ar). Se falhar depois da
    // reivindicação, a campanha ficaria presa em "disparando" para sempre —
    // ninguém a processaria, e uma nova tentativa esbarraria na própria
    // reivindicação. Por isso a reivindicação é desfeita aqui.
    try {
      await inngest.send(
        campanhaDisparoSolicitado.create({
          broadcastId: campanha.id,
          organizationId,
          funnelId: campanha.funnelId,
        }),
      );
    } catch (erro) {
      await prisma.broadcast.updateMany({
        where: { id: campanha.id, organizationId, status: "SENDING" },
        data: { status: campanha.status, startedAt: null },
      });

      console.error("[campanha] falha ao publicar o disparo", {
        broadcastId: campanha.id,
        erro,
      });

      throw errors.INTERNAL_SERVER_ERROR({
        message:
          "Não foi possível agendar o disparo: a fila de tarefas não respondeu. Em ambiente local, rode `pnpm inngest:dev`. A campanha continua como estava — tente de novo depois.",
      });
    }

    return { disparando: true, destinatarios: pendentes };
  });
