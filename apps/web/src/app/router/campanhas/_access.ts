import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";

/**
 * Carrega a campanha conferindo a organização.
 *
 * Campanha manda mensagem em massa: aceitar um id vindo do cliente sem
 * confrontar com a organização autenticada seria disparar em nome de outro
 * tenant, com o número dele.
 */
export async function requireCampanhaDaOrg(
  broadcastId: string,
  organizationId: string,
) {
  const campanha = await prisma.broadcast.findFirst({
    where: { id: broadcastId, organizationId },
    select: {
      id: true,
      funnelId: true,
      status: true,
      templateName: true,
      templateLanguage: true,
      templateCategory: true,
      templateVariables: true,
    },
  });
  if (!campanha) {
    throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada" });
  }
  return campanha;
}
