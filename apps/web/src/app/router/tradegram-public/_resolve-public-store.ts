import prisma from "@/lib/db";

type PublicErrors = {
  NOT_FOUND: (options: { message: string }) => Error;
};

// Só a org (por slug, gate isPublicProfile) — quando a loja não é necessária.
export async function resolvePublicOrg(
  orgSlug: string,
  errors: PublicErrors,
): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, isPublicProfile: true },
  });
  if (!org || !org.isPublicProfile) {
    throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
  }
  return org.id;
}

// Resolve org (por slug, gate isPublicProfile) + loja ativa. Mesmo padrão de
// store-map.ts, extraído porque as procedures do shopper repetem esse porteiro.
export async function resolvePublicStore(
  orgSlug: string,
  storeId: string,
  errors: PublicErrors,
): Promise<{ organizationId: string; storeId: string }> {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, isPublicProfile: true },
  });
  if (!org || !org.isPublicProfile) {
    throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
  }

  const store = await prisma.store.findFirst({
    where: { id: storeId, organizationId: org.id, isActive: true },
    select: { id: true },
  });
  if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

  return { organizationId: org.id, storeId: store.id };
}
