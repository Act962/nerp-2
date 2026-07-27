import { PageHeader } from "@/components/page-header";
import { TradeDashboard } from "@/features/trade-dashboard/components/trade-dashboard";
import { requirePermission } from "@/lib/auth-utils";

// Painel do Trade Marketing: indicadores de todas as funcionalidades.
export default async function TradePainelPage() {
  await requirePermission("trade-painel");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel do Trade"
        description="Indicadores de lojas, mapas, promotor, books, catálogo, planograma e negociações."
      />
      <TradeDashboard />
    </div>
  );
}
