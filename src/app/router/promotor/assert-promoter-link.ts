import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

type LinkErrors = {
  FORBIDDEN: (options: { message: string }) => Error;
};

// Autorização do promotor para registrar foto de uma indústria numa loja.
// Owner/admin passam direto. Caso contrário, dois caminhos autorizam (grafo):
//   1. Direto (Fase 1): vínculo com a loja (PromoterStore) E com a indústria
//      (PromoterSupplier).
//   2. Via distribuidor (Fase 2): o promotor representa um distribuidor que
//      atende a loja E representa a indústria (indústria→distribuidor→loja).
export async function assertPromoterLink(
  userId: string,
  organizationId: string,
  storeId: string,
  supplierId: string,
  errors: LinkErrors,
) {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { id: true, role: true },
  });
  if (!member) {
    throw errors.FORBIDDEN({ message: "Você não é membro desta organização" });
  }
  if (hasFullAccess(member.role)) return;

  const [storeLink, supplierLink, viaDistributor] = await Promise.all([
    prisma.promoterStore.findUnique({
      where: { memberId_storeId: { memberId: member.id, storeId } },
      select: { id: true },
    }),
    prisma.promoterSupplier.findUnique({
      where: { memberId_supplierId: { memberId: member.id, supplierId } },
      select: { id: true },
    }),
    prisma.promoterDistributor.findFirst({
      where: {
        memberId: member.id,
        distributor: {
          stores: { some: { storeId } },
          industries: { some: { supplierId } },
        },
      },
      select: { id: true },
    }),
  ]);

  const hasDirectLink = Boolean(storeLink && supplierLink);
  if (hasDirectLink || viaDistributor) return;

  throw errors.FORBIDDEN({
    message:
      "Você não tem vínculo (direto ou via distribuidor) com esta indústria e loja",
  });
}
