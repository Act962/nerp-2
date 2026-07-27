import { PageHeader } from "@/components/page-header";
import { DistributorsManager } from "@/features/distributor/components/distributors-manager";
import { requirePermission } from "@/lib/auth-utils";

// Cadastro de distribuidores e seus vínculos (indústrias representadas + lojas
// atendidas). É a ponte do grafo indústria→distribuidor→loja que autoriza
// promotores sem vínculo direto.
export default async function DistributorsPage() {
  await requirePermission("distribuidores");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distribuidores"
        description="Cadastre distribuidores e vincule as indústrias que representam e as lojas que atendem."
      />
      <DistributorsManager />
    </div>
  );
}
