import type { ReactNode } from "react";
import { requireSiteAdmin } from "@/lib/site-admin";
import { SiteAdminShell } from "@/features/site/components/site-admin-shell";

/**
 * Admin do site institucional. Fora da casca do ERP de propósito: aqui não há
 * organização ativa, e o menu lateral do ERP não faz sentido para quem só
 * cuida do site.
 */
export default async function SiteAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await requireSiteAdmin();

  return (
    <SiteAdminShell
      name={access.name ?? access.email}
      role={access.isSuperAdmin ? "super admin" : access.role.toLowerCase()}
      canManageAccess={access.isSuperAdmin}
    >
      {children}
    </SiteAdminShell>
  );
}
