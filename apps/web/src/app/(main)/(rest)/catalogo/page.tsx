import { CatalogSettings } from "@/features/catalogo/components/catalog";
import { SubdomainWarningBanner } from "@/features/catalogo/components/subdomain-warning-banner";
import { requirePermission, currentOrganization } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page() {
  await requirePermission("catalogo");
  const org = await currentOrganization();
  // `getFullOrganization()` do Better Auth não devolve `subdomain` — puxamos
  // separado só para montar a URL do catálogo por caminho.
  const orgWithSubdomain = org
    ? await prisma.organization.findUnique({
        where: { id: org.id },
        select: { subdomain: true },
      })
    : null;
  return (
    <>
      <SubdomainWarningBanner
        subdomain={orgWithSubdomain?.subdomain ?? null}
      />
      <CatalogSettings />
    </>
  );
}
