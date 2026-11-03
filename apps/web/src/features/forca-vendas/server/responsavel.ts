import "server-only";

import prisma from "@/lib/db";

/**
 * Usuário do vendedor que atende o cliente: o principal da carteira e, sem
 * principal marcado, o primeiro que entrou nela. É quem herda a conversa que
 * chega pelo número oficial da empresa.
 */
export async function responsavelPelaCarteira(
  organizationId: string,
  customerId: string,
): Promise<string | null> {
  const carteira = await prisma.carteiraCliente.findFirst({
    where: { organizationId, customerId },
    orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
    select: { member: { select: { userId: true } } },
  });
  return carteira?.member.userId ?? null;
}
