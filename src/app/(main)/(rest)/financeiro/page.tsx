import { PageHeader } from "@/components/page-header";
import { FinanceiroPage } from "@/features/financeiro/components/financeiro-page";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("financeiro");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contas a pagar e a receber, fluxo de caixa"
      />
      <FinanceiroPage />
    </div>
  );
}
