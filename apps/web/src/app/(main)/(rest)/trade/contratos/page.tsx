import { PageHeader } from "@/components/page-header";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { ContractsPage } from "@/features/contracts/components/contracts-page";

export default async function ContratosPage() {
  await requireTradeAccess("contratos");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Contratos de ocupação por ID de espaço, com geração de recebíveis no Financeiro."
      />
      <ContractsPage />
    </div>
  );
}
