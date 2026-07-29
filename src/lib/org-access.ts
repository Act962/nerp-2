import "server-only";

import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

export async function getMemberRole(
  orgId: string,
  userId: string,
): Promise<string | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { role: true },
  });
  return member?.role ?? null;
}

// Handlers checam isto e lançam via o `errors` tipado do procedure.
export async function isOrgAdmin(
  orgId: string,
  userId: string,
): Promise<boolean> {
  return hasFullAccess(await getMemberRole(orgId, userId));
}

// Versão genérica pra qualquer feature nova (ranking tem a própria, com
// mensagem específica, em src/app/router/ranking/_access.ts — não duplicar
// aqui, só reaproveitar este quem ainda não tem wrapper próprio).
export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(orgId, userId))) {
    throw new ORPCError("FORBIDDEN", {
      message: "Apenas administradores podem executar esta operação.",
    });
  }
}
