import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireConversaDaOrg } from "@/app/router/conversation/_access";
import { enviarTexto } from "@/features/whatsapp-chat/server/enviar-texto";

/**
 * Envia uma mensagem de texto pela conversa.
 *
 * A sequência (resolver provedor → cobrar → enviar → gravar, com estorno se o
 * envio falhar) mora em `enviarTexto`, porque a automação manda mensagem pelo
 * mesmo caminho. Aqui fica só a tradução do resultado para os erros tipados
 * que a tela entende.
 */
export const sendMessage = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Envia mensagem de texto", tags: ["Chat"] })
  .input(
    z.object({
      conversationId: z.string().min(1),
      corpo: z.string().trim().min(1, "Escreva alguma coisa"),
      respondeA: z.string().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      externalMessageId: z.string(),
      createdAt: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    await requireConversaDaOrg(input.conversationId, organizationId);

    const resultado = await enviarTexto({
      organizationId,
      conversationId: input.conversationId,
      corpo: input.corpo,
      respondeA: input.respondeA,
      autorId: context.user.id,
    });

    if (!resultado.ok) {
      if (resultado.codigo === "FALHA_NO_ENVIO") {
        throw errors.INTERNAL_SERVER_ERROR({ message: resultado.mensagem });
      }
      throw errors.BAD_REQUEST({
        message: resultado.mensagem,
        data: {
          code:
            resultado.codigo === "JANELA_FECHADA"
              ? "META_WINDOW_CLOSED"
              : resultado.codigo,
        },
      });
    }

    return {
      id: resultado.messageId,
      externalMessageId: resultado.externalMessageId,
      createdAt: resultado.createdAt.toISOString(),
    };
  });
