import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";

/**
 * Quem pode ALTERAR catálogos promocionais.
 *
 * Ler é a permissão de página (`catalogo-promocional`); escrever exige a
 * permissão de AÇÃO `catalogo-promocional-editar`. Assim dá para ter alguém
 * que abre e só consulta. Owner/admin passam direto (`memberCan` já trata).
 *
 * A checagem é no SERVIDOR de propósito: esconder o botão no cliente é
 * conveniência, não controle de acesso.
 */
export async function assertCanEditCatalog(
  orgId: string,
  userId: string,
  errors: { FORBIDDEN: (opts: { message: string }) => Error },
): Promise<void> {
  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { role: true, permissions: true },
  });
  if (!memberCan(member, "catalogo-promocional-editar")) {
    throw errors.FORBIDDEN({
      message: "Você não tem permissão para editar catálogos promocionais",
    });
  }
}
