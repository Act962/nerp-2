import { PageHeader } from "@/components/page-header";
import { PlanManager } from "@/features/billing/components/plan-manager";
import { requirePermission } from "@/lib/auth-utils";
import { Suspense } from "react";

// Plano & Assinatura do Trade Marketing. Nunca é gated por plano (senão não
// daria para fazer upgrade) — só exige a permissão da página.
export default async function TradePlanPage() {
  await requirePermission("plano");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plano & Assinatura"
        description="Escolha o plano de trade da sua organização e acompanhe o uso das cotas."
      />
      <Suspense>
        <PlanManager />
      </Suspense>
    </div>
  );
}
