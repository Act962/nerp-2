import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";

/**
 * Confere que a conversa é da organização do contexto e devolve o que o
 * caminho de envio precisa, numa consulta só.
 *
 * `NOT_FOUND` e não `FORBIDDEN`: distinguir "não existe" de "não é seu" já
 * conta que o id existe.
 */
export async function requireConversaDaOrg(
  conversationId: string,
  organizationId: string,
) {
  const conversa = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: {
      id: true,
      funnelId: true,
      lead: { select: { id: true, phone: true, statusFlow: true } },
    },
  });
  if (!conversa) {
    throw new ORPCError("NOT_FOUND", { message: "Conversa não encontrada" });
  }
  return conversa;
}
