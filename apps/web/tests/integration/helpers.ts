import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";

/**
 * Contexto S2S aceito por `requireAuthMiddleware` e `requireOrgMiddleware`.
 *
 * Os dois middlewares já têm um ramo para integrações máquina-a-máquina que
 * dispensa sessão do Better Auth — é por ele que o teste entra, em vez de
 * forjar cookie e header de sessão.
 */
export function s2sContext(
  user: User,
  org: Organization,
  scopes: string[] = [],
) {
  return {
    headers: new Headers(),
    isS2S: true as const,
    s2sUser: user,
    s2sOrg: org,
    s2sScopes: scopes,
  };
}

/**
 * Contexto de dispositivo desktop — o principal que `verifyDeviceAuth` injeta
 * na rota. Usa o ramo `isDevice` de `requireAuthMiddleware`/`requireOrgMiddleware`.
 */
export function deviceContext(
  user: User,
  org: Organization,
  scopes: string[] = [],
) {
  return {
    headers: new Headers(),
    isDevice: true as const,
    deviceUser: user,
    deviceOrg: org,
    deviceScopes: scopes,
  };
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${counter++}`;

export async function createOrg(name = "Org de teste"): Promise<Organization> {
  const suffix = unique();
  return prisma.organization.create({
    data: { name: `${name} ${suffix}`, slug: `org-${suffix}` },
  });
}

export async function createUser(): Promise<User> {
  const suffix = unique();
  return prisma.user.create({
    data: { name: `Usuário ${suffix}`, email: `user-${suffix}@teste.local` },
  });
}

/** Vincula o usuário à org como owner — o cargo que passa por toda permissão. */
export async function createMember(user: User, org: Organization) {
  return prisma.member.create({
    data: { organizationId: org.id, userId: user.id, role: "owner" },
  });
}

/**
 * Limpa o que os testes criam. Cascata de `Organization` derruba fornecedor e
 * member; `Device` (sem @relation) e o usuário precisam ir separado.
 */
export async function resetDb() {
  const testOrgs = await prisma.organization.findMany({
    where: { slug: { startsWith: "org-" } },
    select: { id: true },
  });
  const orgIds = { organizationId: { in: testOrgs.map((org) => org.id) } };

  // Ordem importa: SaleItem/StockMovement referenciam Product (FK restrita), e
  // a cascata da Organization tentaria apagar Product antes deles. Removemos os
  // filhos que travam a cascata primeiro.
  await prisma.stockMovement.deleteMany({ where: orgIds });
  await prisma.sale.deleteMany({ where: orgIds }); // cascata: SaleItem + SalePayment
  await prisma.product.deleteMany({ where: orgIds });
  await prisma.device.deleteMany({ where: orgIds });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: "org-" } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@teste.local" } },
  });
}
