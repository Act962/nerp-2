import "server-only";
import prisma from "@/lib/db";
import { hasFullAccess, memberCan } from "@/lib/permissions";

export interface PurchaseAccess {
  /** Digitar, editar e cancelar rascunho. */
  canManage: boolean;
  /** Processar: mexe em estoque, custo, preço de venda e contas a pagar. */
  canProcess: boolean;
}

/**
 * Quem digita a nota e quem a processa não precisam ser a mesma pessoa.
 *
 * Digitar é conferência de papel; processar move estoque, reescreve o custo de
 * cada produto e cria dívida no Financeiro. Por isso a ação separada, no mesmo
 * espírito das chaves `caixa-*`. Uma consulta só ao `member`, devolvendo as
 * duas respostas.
 */
export async function getPurchaseAccess(
  organizationId: string,
  userId: string,
): Promise<PurchaseAccess> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true, permissions: true },
  });
  if (!member) return { canManage: false, canProcess: false };
  if (hasFullAccess(member.role)) return { canManage: true, canProcess: true };

  const canManage = memberCan(member, "estoque");
  return {
    canManage,
    canProcess: canManage && memberCan(member, "estoque-entrada-processar"),
  };
}
