import prisma from "./db";
import { enqueueSyncOutbox } from "./sync-outbox";
import { verifyWaiterJoinToken } from "./waiter-join-token";

/**
 * Concede membership a partir de um joinToken válido e marca a org como ativa
 * na sessão. Idempotente: se já for membro, não duplica.
 *
 * Criar o Member via Prisma cru NÃO dispara o hook `afterAddMember` do Better
 * Auth (`src/lib/auth.ts`), então replicamos aqui o enqueue de sync de membro.
 *
 * Retorna true se o usuário está (ou ficou) membro da org; false se o token é
 * inválido/expirado ou não corresponde a esta org.
 */
export async function acceptWaiterJoin(
  userId: string,
  orgId: string,
  token: string | undefined,
  sessionId: string,
): Promise<boolean> {
  if (!token) return false;
  const payload = verifyWaiterJoinToken(token);
  if (!payload || payload.orgId !== orgId) return false;

  const existing = await prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { id: true },
  });

  if (!existing) {
    const member = await prisma.member.create({
      data: { organizationId: orgId, userId, role: payload.role },
    });
    await enqueueSyncOutbox("member", {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: new Date(member.createdAt).toISOString(),
    });
  }

  // Define a org do QR como ativa (padrão de cross-login-plugin.ts).
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: orgId },
  });

  return true;
}
