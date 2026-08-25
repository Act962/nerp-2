import prisma from "@/lib/db";
import { hasFullAccess, memberCan } from "@/lib/permissions";

/**
 * Quem pode mexer no cadastro de clientes a partir do mapa.
 *
 * Uma função só porque cadastrar pelo clique, importar do OpenStreetMap e trocar
 * a logo são a MESMA autorização — se um dia divergirem, é porque alguém mudou
 * um lugar e esqueceu os outros dois.
 */
export async function canManageStores(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true, permissions: true },
  });
  if (!member) return false;
  return hasFullAccess(member.role) || memberCan(member, "lojas");
}
