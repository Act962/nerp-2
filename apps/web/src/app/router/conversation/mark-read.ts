import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireConversaDaOrg } from "./_access";

/**
 * Zera o badge de não-lidas quando o atendente abre a conversa.
 *
 * Mexe só em `seen`, nunca em `status`: `status` são os tiques que o
 * destinatário vê na mensagem que ele mandou, e não têm nada a ver com o
 * atendente ter aberto a tela.
 */
export const markRead = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Marca a conversa como lida",
    tags: ["Chat"],
  })
  .input(z.object({ conversationId: z.string().min(1) }))
  .output(z.object({ marcadas: z.number() }))
  .handler(async ({ input, context }) => {
    await requireConversaDaOrg(input.conversationId, context.org.id);

    const { count } = await prisma.message.updateMany({
      where: {
        conversationId: input.conversationId,
        organizationId: context.org.id,
        seen: false,
        fromMe: false,
      },
      data: { seen: true },
    });

    return { marcadas: count };
  });
