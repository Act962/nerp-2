import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";

/**
 * Garante que o funil é da organização do contexto.
 *
 * Existe porque o escopo por organização aqui é manual: o `funnelId` chega do
 * cliente e não pode ser usado antes de ser confrontado com a organização
 * autenticada. Devolve `NOT_FOUND` e não `FORBIDDEN` de propósito — dizer
 * "existe, mas não é seu" já é contar que existe.
 */
export async function requireFunnelDaOrg(
  funnelId: string,
  organizationId: string,
): Promise<{ id: string }> {
  const funil = await prisma.crmFunnel.findFirst({
    where: { id: funnelId, organizationId },
    select: { id: true },
  });
  if (!funil) {
    throw new ORPCError("NOT_FOUND", { message: "Funil não encontrado" });
  }
  return funil;
}
