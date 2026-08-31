import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";

/**
 * Garante que a agenda é da organização do contexto.
 *
 * O `agendaId` chega do cliente e não pode ser usado antes de ser confrontado
 * com a organização autenticada — o escopo por organização aqui é manual.
 * `NOT_FOUND` e não `FORBIDDEN`: dizer "existe, mas não é sua" já é contar que
 * existe.
 */
export async function requireAgendaDaOrg(
  agendaId: string,
  organizationId: string,
): Promise<{ id: string; funnelId: string; slotDuration: number }> {
  const agenda = await prisma.agenda.findFirst({
    where: { id: agendaId, organizationId },
    select: { id: true, funnelId: true, slotDuration: true },
  });
  if (!agenda) {
    throw new ORPCError("NOT_FOUND", { message: "Agenda não encontrada" });
  }
  return agenda;
}

/** Slug de URL: minúsculo, sem acento, com hífen no lugar do espaço. */
export function comoSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
