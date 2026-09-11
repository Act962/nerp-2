import { headers } from "next/headers";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import prisma from "./db";
import {
  canViewPage,
  firstAllowedHref,
  isReadOnlyViewer,
  memberHasPermission,
  type PagePermissionKey,
} from "./permissions";

export const requireAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session;
};

// Sessão sem organização ativa deixava o usuário numa tela vazia mesmo sendo
// membro de alguma empresa — e a maioria só tem uma. Aqui a associação mais
// antiga vira a organização ativa, para ele entrar direto em vez de ter que
// abrir o seletor. Só devolve null quando ele não pertence a nenhuma.
const activateFirstOrganization = async (userId: string) => {
  const membership = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (!membership) return null;

  const requestHeaders = await headers();

  await auth.api.setActiveOrganization({
    headers: requestHeaders,
    body: { organizationId: membership.organizationId },
  });

  // Busca pelo id em vez de reler a sessão: o `activeOrganizationId` acabou de
  // mudar no banco e reler pelos headers desta mesma request pode devolver o
  // valor anterior.
  return await auth.api.getFullOrganization({
    headers: requestHeaders,
    query: { organizationId: membership.organizationId },
  });
};

// Depois do fallback acima, continuar sem organização só acontece quando o
// usuário não é membro de nenhuma. Mandar pro /dashboard fazia a própria
// /dashboard redirecionar pra si mesma (ERR_TOO_MANY_REDIRECTS), e mandar pro
// /create-organization empurrava para criar outra empresa exatamente quem já
// tinha conta e só entrou com o e-mail errado — o chamado que queremos evitar.
// `/sem-empresa` não tem guarda e cai na `EmptyOrganization` do layout.
const NO_ORGANIZATION_HREF = "/sem-empresa";

const resolveActiveOrganization = async (userId: string) => {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  return organization ?? (await activateFirstOrganization(userId));
};

// Server-side guard: bloqueia páginas admin se o member não tiver permissão.
// Owner/Admin sempre passam. Sem member → redireciona.
export const requirePermission = async (key: PagePermissionKey) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const org = await resolveActiveOrganization(session.user.id);
  if (!org) redirect(NO_ORGANIZATION_HREF);

  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
    select: { role: true, permissions: true },
  });

  if (memberHasPermission(member, key)) return;

  const fallback = firstAllowedHref(member);
  redirect(fallback ?? "/sem-acesso");
};

// Como `requirePermission`, mas para páginas que o cargo PROMOTOR também
// enxerga em modo somente-leitura (hoje: Lojas e Fornecedores). Quem chama
// usa `readOnly` para esconder criar/editar/excluir na tela — a garantia de
// verdade contra escrita continua nos procedures (`_can-manage-*`).
export const requireViewAccess = async (
  key: PagePermissionKey,
): Promise<{ readOnly: boolean }> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const org = await resolveActiveOrganization(session.user.id);
  if (!org) redirect(NO_ORGANIZATION_HREF);

  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
    select: { role: true, permissions: true, tradeRole: true },
  });

  if (canViewPage(member, key)) {
    return { readOnly: isReadOnlyViewer(member, key) };
  }

  const fallback = firstAllowedHref(member);
  redirect(fallback ?? "/sem-acesso");
};

export const requireUnauth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }
};

/**
 * Marca o acesso da organização, no máximo uma vez por hora. É o relógio da
 * expiração da sandbox (`expirar-sandbox.ts`) — e um `updateMany`
 * condicionado, para toda página não virar um UPDATE.
 */
export const tocarUltimoAcesso = async (organizationId: string) => {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.organization
    .updateMany({
      where: {
        id: organizationId,
        OR: [{ lastAccessAt: null }, { lastAccessAt: { lt: umaHoraAtras } }],
      },
      data: { lastAccessAt: new Date() },
    })
    .catch(() => {});
};

export const currentOrganization = async () => {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  if (organization) {
    await tocarUltimoAcesso(organization.id);
    return organization;
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  return await activateFirstOrganization(session.user.id);
};
