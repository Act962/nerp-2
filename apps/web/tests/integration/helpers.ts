import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { DEFAULT_DEVICE_SCOPES } from "@/lib/device-scopes";

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
 *
 * O default é o escopo de um terminal real (`DEFAULT_DEVICE_SCOPES`); passe
 * uma lista menor para exercitar a negativa por escopo.
 */
export function deviceContext(
  user: User,
  org: Organization,
  scopes: readonly string[] = DEFAULT_DEVICE_SCOPES,
) {
  return {
    headers: new Headers(),
    isDevice: true as const,
    deviceUser: user,
    deviceOrg: org,
    deviceScopes: [...scopes],
  };
}

/**
 * Opções completas de `call()` para um device: contexto + `path`.
 *
 * O `path` importa: a autorização do terminal é por procedure
 * (`device-scopes.ts`) e é dele que o middleware descobre qual está sendo
 * chamada. Na rota HTTP e no `createRouterClient` ele vem de graça; num
 * `call()` direto, quem chama informa — então o teste passa pelo MESMO guard
 * que o request real.
 */
export function deviceOptions(
  user: User,
  org: Organization,
  path: readonly string[],
  scopes?: readonly string[],
) {
  return { context: deviceContext(user, org, scopes), path };
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

  // Ordem importa: SaleItem/StockMovement/CashMovement referenciam Product/Sale
  // (FK restrita), e a cascata da Organization tentaria apagá-los na ordem
  // errada. Removemos os filhos que travam a cascata primeiro.
  await prisma.cashMovement.deleteMany({ where: orgIds });
  await prisma.stockMovement.deleteMany({ where: orgIds });
  await prisma.sale.deleteMany({ where: orgIds }); // cascata: SaleItem + SalePayment
  await prisma.cashSession.deleteMany({ where: orgIds });
  await prisma.cashRegister.deleteMany({ where: orgIds });
  await prisma.product.deleteMany({ where: orgIds });
  await prisma.device.deleteMany({ where: orgIds });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: "org-" } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@teste.local" } },
  });
}
