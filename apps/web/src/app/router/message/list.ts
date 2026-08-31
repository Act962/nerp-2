import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireConversaDaOrg } from "@/app/router/conversation/_access";
import prisma from "@/lib/db";

/**
 * Mensagens de uma conversa, da mais nova para a mais antiga.
 *
 * O cursor é o `createdAt` da mais antiga já carregada: a conversa cresce pelo
 * topo enquanto o atendente rola para trás, e paginar por número de página
 * faria mensagem repetir ou pular. A tela recebe em ordem decrescente e
 * inverte na renderização.
 *
 * `mediaKey` **não** sai daqui: é chave de bucket privado. A tela pede o
 * arquivo por `/api/whatsapp/media/{id}`, que confere a organização antes de
 * ler o objeto.
 */
export const listMessages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Lista as mensagens da conversa",
    tags: ["Chat"],
  })
  .input(
    z.object({
      conversationId: z.string().min(1),
      cursor: z.string().optional(),
      limite: z.number().int().min(1).max(100).default(30),
    }),
  )
  .output(
    z.object({
      mensagens: z.array(
        z.object({
          id: z.string(),
          corpo: z.string().nullable(),
          fromMe: z.boolean(),
          status: z.enum(["SENT", "DELIVERED", "SEEN", "FAILED", "DELETED"]),
          senderName: z.string().nullable(),
          temMidia: z.boolean(),
          tipoDeMidia: z.string().nullable(),
          mimetype: z.string().nullable(),
          fileName: z.string().nullable(),
          latitude: z.number().nullable(),
          longitude: z.number().nullable(),
          respondeA: z
            .object({ id: z.string(), corpo: z.string().nullable() })
            .nullable(),
          createdAt: z.string(),
        }),
      ),
      proximoCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireConversaDaOrg(input.conversationId, context.org.id);

    const mensagens = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
        organizationId: context.org.id,
        ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limite,
      select: {
        id: true,
        body: true,
        fromMe: true,
        status: true,
        senderName: true,
        mediaKey: true,
        mediaType: true,
        mimetype: true,
        fileName: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        quotedMessage: { select: { id: true, body: true } },
      },
    });

    const maisAntiga = mensagens.at(-1);

    return {
      mensagens: mensagens.map((mensagem) => ({
        id: mensagem.id,
        corpo: mensagem.body,
        fromMe: mensagem.fromMe,
        status: mensagem.status,
        senderName: mensagem.senderName,
        // Só o fato de existir arquivo — a chave fica no servidor.
        temMidia: Boolean(mensagem.mediaKey),
        tipoDeMidia: mensagem.mediaType,
        mimetype: mensagem.mimetype,
        fileName: mensagem.fileName,
        latitude: mensagem.latitude,
        longitude: mensagem.longitude,
        respondeA: mensagem.quotedMessage
          ? {
              id: mensagem.quotedMessage.id,
              corpo: mensagem.quotedMessage.body,
            }
          : null,
        createdAt: mensagem.createdAt.toISOString(),
      })),
      proximoCursor:
        mensagens.length === input.limite && maisAntiga
          ? maisAntiga.createdAt.toISOString()
          : null,
    };
  });
