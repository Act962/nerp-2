import { PageHeader } from "@/components/page-header";
import { NetworkSiglaCard } from "@/features/configuracoes/components/network-sigla-card";
import { OrgLogoCard } from "@/features/configuracoes/components/org-logo-card";
import { OrganizationSettingsTabs } from "@/features/configuracoes/components/organization-settings-tabs";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("configuracoes");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Membros, convites e permissões da organização."
      />
      <OrgLogoCard />
      <NetworkSiglaCard />
      <OrganizationSettingsTabs />
    </div>
  );
}
