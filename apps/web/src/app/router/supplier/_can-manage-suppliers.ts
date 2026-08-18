import prisma from "@/lib/db";
import { hasFullAccess, memberCan } from "@/lib/permissions";

/**
 * Quem pode criar/editar/excluir/importar fornecedores. PROMOTOR só enxerga a
 * lista (ver `supplier/list.ts`) — precisa da permissão de página de verdade
 * pra escrever, senão a visão somente-leitura vira escrita por quem chama o
 * procedure direto.
 */
export async function canManageSuppliers(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true, permissions: true },
  });
  if (!member) return false;
  return hasFullAccess(member.role) || memberCan(member, "fornecedores");
}
