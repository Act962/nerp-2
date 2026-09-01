import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SiteAdminRole } from "@/generated/prisma/enums";
import { auth } from "./auth";
import prisma from "./db";

/**
 * Acesso ao admin do site institucional.
 *
 * Diferente do resto do ERP, aqui não existe organização: o site é um só. Quem
 * entra é o super admin — um e-mail fixo, que não sai da lista pela tela — ou
 * alguém que ele convidou (`SiteAdmin`). Ninguém mais: sem registro, a rota
 * redireciona antes de renderizar.
 */

/**
 * O super admin vem do ambiente para não ficar preso ao código, mas tem um
 * padrão: em produção esquecer a variável não pode significar "ninguém
 * administra o site".
 */
export const SITE_SUPER_ADMIN_EMAIL = (
  process.env.SITE_SUPER_ADMIN_EMAIL ?? "weydsonlima@gmail.com"
).toLowerCase();

export type SiteAdminAccess = {
  email: string;
  name: string | null;
  role: SiteAdminRole;
  isSuperAdmin: boolean;
};

/** Quem pode mexer em acessos e apagar coisas. */
export function canManageAccess(access: SiteAdminAccess) {
  return access.isSuperAdmin;
}

/** REDATOR só encosta em texto e imagem de página que já existe. */
export function canManageStructure(access: SiteAdminAccess) {
  return access.role !== "REDATOR";
}

/**
 * Resolve o acesso do usuário logado, ou `null` se ele não for administrador
 * do site. Não redireciona — use em lugares que precisam decidir (o layout
 * decide; um procedure lança erro).
 */
export async function getSiteAdminAccess(
  requestHeaders?: Headers,
): Promise<SiteAdminAccess | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  if (!session?.user?.email) return null;

  const email = session.user.email.toLowerCase();

  if (email === SITE_SUPER_ADMIN_EMAIL) {
    return {
      email,
      name: session.user.name ?? null,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    };
  }

  const admin = await prisma.siteAdmin.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, userId: true },
  });
  if (!admin) return null;

  // Primeiro acesso de quem foi convidado por e-mail: amarra o userId agora,
  // que é o que permite mostrar "quem editou" sem pedir nada a mais.
  if (!admin.userId) {
    await prisma.siteAdmin.update({
      where: { id: admin.id },
      data: { userId: session.user.id, name: admin.name ?? session.user.name },
    });
  }

  return {
    email,
    name: admin.name ?? session.user.name ?? null,
    // O papel SUPER_ADMIN só vale para o e-mail do ambiente: uma linha na
    // tabela com esse papel não promove ninguém.
    role: admin.role === "SUPER_ADMIN" ? "EDITOR" : admin.role,
    isSuperAdmin: false,
  };
}

/** Guarda de página: sem acesso, sai daqui. */
export async function requireSiteAdmin(): Promise<SiteAdminAccess> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Volta para o site, e não para `/sem-acesso`: aquela página vive dentro da
  // casca do ERP e exige organização ativa — quem entrou só para ver o admin
  // do site pode não ter nenhuma.
  const access = await getSiteAdminAccess();
  if (!access) redirect("/");

  return access;
}
